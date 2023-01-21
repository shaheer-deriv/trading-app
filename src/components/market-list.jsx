import {
  DataTable,
  DisplayChangePercent,
  DisplayTickValue,
} from "../components";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  activeSymbols,
  fetchMarketTick,
  market_ticks,
  setMarketTicks,
} from "../stores";
import { addDays, formatDate } from "../utils/format-value";
import { forgetAll, sendRequest } from "../utils/socket-base";

import { ERROR_CODE } from "../constants/error-codes";
import { segregateMarkets } from "../utils/map-markets";
import styles from "../styles/accordion.module.scss";
import throttle from "lodash.throttle";

const MarketList = () => {
  const header = [
    { title: "Name", ref: "display_name" },
    { title: "Change %", ref: "change", cell_content: DisplayChangePercent },
    { title: "Price", ref: "tick", cell_content: DisplayTickValue },
  ];

  const MARKET_TYPE = "synthetic_index"; // "indices";

  const [all_markets, setAllMarkets] = createSignal([]);
  const [available_markets, setAvailableMarkets] = createSignal([]);
  const [market_data, setMarketData] = createSignal(null);

  onMount(() => {
    setAllMarkets(segregateMarkets(activeSymbols()));
    getAvailableMarkets(MARKET_TYPE);
    getMarketData(MARKET_TYPE);
  });

  onCleanup(() => {
    forgetAll("ticks");
  });

  const getSymbol = (target_symbol, trading_times) => {
    let symbol;
    const { markets } = trading_times;
    for (let i = 0; i < markets.length; i++) {
      const { submarkets } = markets[i];
      for (let j = 0; j < submarkets.length; j++) {
        const { symbols } = submarkets[j];
        symbol = symbols.find((item) => item.symbol === target_symbol);
        if (symbol !== undefined) return symbol;
      }
    }
  };

  const generateDataSet = () =>
    available_markets().map((markets) => ({
      display_name: markets.display_name,
      change: markets.symbol,
      tick: markets.symbol,
    }));

  const fetchAvailableMarketSymbols = (market_type) =>
    available_markets().filter(
      (market_data) => market_data.market === market_type
    );

  const generateTickData = ({
    previous = 0,
    current = 0,
    is_closed = false,
    is_suspended = false,
    opens_at = null,
  }) => ({ previous, current, is_closed, is_suspended, opens_at });

  const calculateTimeLeft = (remaining_time_to_open) => {
    const difference = remaining_time_to_open - Date.now();
    return difference > 0
      ? {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        }
      : {};
  };

  const checkWhenMarketOpens = async (days_offset, target_symbol) => {
    const target_date = addDays(new Date(), days_offset);
    const api_response = await getTradeTimings(formatDate(target_date));
    if (!api_response.api_initial_load_error) {
      const { times } = getSymbol(target_symbol, api_response.trading_times);
      const { open, close } = times;
      const is_closed_all_day =
        open?.length === 1 && open[0] === "--" && close[0] === "--";
      if (is_closed_all_day) {
        return checkWhenMarketOpens(days_offset + 1, target_symbol);
      }
      const date_str = target_date.toISOString().substring(0, 11);
      const getUTCDate = (hour) => new Date(`${date_str}${hour}Z`);
      let remaining_time_to_open;
      for (let i = 0; i < open?.length; i++) {
        const diff = +getUTCDate(open[i]) - Date.now();
        if (diff > 0) {
          remaining_time_to_open = +getUTCDate(open[i]);
          setMarketTicks({
            ...market_ticks(),
            [target_symbol]: generateTickData({
              is_closed: true,
              opens_at: calculateTimeLeft(remaining_time_to_open),
            }),
          });
        }
      }
    }
  };

  const getTradeTimings = async (date_string) => {
    const data = await sendRequest({ trading_times: date_string });
    if (data.error) {
      return { api_initial_load_error: data.error.message };
    }
    return data;
  };

  const marketDataHandler = async (response) => {
    if (!response.error) {
      const { quote, symbol } = response.tick;
      const prev_value = market_ticks()[symbol]?.current ?? 0;
      const current_value = quote;
      setMarketTicks({
        ...market_ticks(),
        [symbol]: generateTickData({
          previous: prev_value,
          current: current_value,
        }),
      });
    } else {
      // eslint-disable-next-line no-console
      const { echo_req, error } = response;
      if (error.code === ERROR_CODE.market_closed) {
        await checkWhenMarketOpens(0, echo_req.ticks);
      }
    }
  };

  const getMarketData = async (market_type) => {
    // forgetAll("ticks");
    const requiredMarkets = fetchAvailableMarketSymbols(market_type);
    const symbol_list = requiredMarkets.map((market) => market.symbol);
    // await wait("forget_all");
    setMarketData(generateDataSet());
    symbol_list.forEach(async (symbol) => {
      await fetchMarketTick(symbol, throttle(marketDataHandler, 500));
    });
  };

  const getAvailableMarkets = (market_type) =>
    setAvailableMarkets(all_markets()[market_type]);

  return (
    <>
      <h3 class={styles["title"]}>What would you like to trade with?</h3>
      <Show when={market_data()}>
        <DataTable headers={header} data={market_data()} show_header={true} />
      </Show>
    </>
  );
};

export default MarketList;
