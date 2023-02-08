import { Show, createEffect, createSignal, onMount, For } from "solid-js";
import {
  balance_of_all_accounts,
  currencies_config,
  icons,
  login_information,
  logout,
} from "Stores/base-store";
import { isDesktop, isMobile } from "Utils/responsive";
import { is_light_theme, setIsLightTheme } from "../stores";
import { Button } from "../components";
import Logo from "../../src/assets/logo2.png";
import classNames from "classnames";
import { loginUrl } from "Constants/deriv-urls";
import { setshowAccountSwitcher } from "Stores/ui-store";
import styles from "../styles/navbar.module.scss";
import { useNavigate } from "solid-app-router";
import { addComma } from "Utils/format-value";

const NavBar = () => {
  const navigate = useNavigate();
  const current_acc_data = () => {
    const account = login_information?.active_account
      ? JSON.parse(login_information?.active_account)
      : {};
    if (account) return balance_of_all_accounts()[account.loginid];

    logout();
  };

  const [checked, setChecked] = createSignal(false);
  const [account_currency_icon, setAccountCurrencyIcon] = createSignal([]);

  createEffect(() => {
    const currency = current_acc_data()?.demo_account
      ? "virtual"
      : current_acc_data()?.currency;

    const account_currency_icon = icons.filter(
      (icon) => icon.name === currency?.toLowerCase()
    );

    setAccountCurrencyIcon(account_currency_icon);
  });

  const AccountHeader = () => {
    return (
      <Show
        when={
          login_information.is_logged_in &&
          balance_of_all_accounts() &&
          current_acc_data()
        }
        fallback={<></>}
      >
        <div class={styles.account_wrapper}>
          <For each={account_currency_icon()}>
            {({ SvgComponent }) => {
              return <SvgComponent height="24" width="24" />;
            }}
          </For>
          <span>
            {addComma(
              current_acc_data()?.balance,
              currencies_config()[current_acc_data()?.currency]
                ?.fractional_digits
            )}{" "}
            {current_acc_data()?.currency}
          </span>
          <i class={styles.arrow_down} />
        </div>
      </Show>
    );
  };

  return (
    <section
      id="app_navbar"
      class={isDesktop() ? styles.topnav_desktop : styles.topnav_mobile}
    >
      {isMobile() && (
        <>
          <input
            id={styles.menu_toggle}
            type="checkbox"
            checked={checked()}
            onClick={() => {
              setChecked(!checked());
            }}
          />
          <label class={styles.menu_button_container} for={styles.menu_toggle}>
            <div class={styles.menu_button} />
          </label>
          <a href="/" class={styles.logo}>
            <img src={Logo} class={styles.logo} />
          </a>
        </>
      )}
      <ul class={styles.menu}>
        {isDesktop() && (
          <li>
            <a href="/" class={styles.logo}>
              <img src={Logo} class={styles.logo} />
            </a>
          </li>
        )}
        <li
          onClick={() => {
            navigate("/trade", { replace: true });
            setChecked(false);
          }}
        >
          Trade
        </li>
        {login_information.is_logged_in && (
          <li
            onClick={() => {
              navigate("/reports", { replace: true });
              setChecked(false);
            }}
          >
            Report
          </li>
        )}
        <li>
          Theme &nbsp;
          <ThemeToggle />
        </li>
        {login_information.is_logged_in && <li onClick={logout}> Sign Out</li>}
      </ul>
      {login_information.is_logged_in ? (
        <Button
          category="secondary"
          onClick={() => setshowAccountSwitcher(true)}
        >
          <div class={styles.account_wrapper}>
            <AccountHeader />
          </div>
        </Button>
      ) : (
        !login_information.is_logging_in && (
          <div
            onClick={() =>
              (window.location.href = loginUrl({ language: "en" }))
            }
          >
            <b>Log In</b>
          </div>
        )
      )}
    </section>
  );
};

const toggleThemeHandler = (event) => {
  setIsLightTheme(event.target.checked);
  localStorage.setItem("dark_theme", event.target.checked);
};

const ThemeToggle = () => {
  onMount(() => {
    const is_dark_theme = JSON.parse(localStorage.getItem("dark_theme"));
    setIsLightTheme(is_dark_theme ?? true);
  });

  return (
    <label class={styles["switch"]}>
      <input
        type={"checkbox"}
        checked={is_light_theme()}
        onChange={toggleThemeHandler}
      />
      <span class={classNames(styles["slider"], styles["round"])} />
    </label>
  );
};

export default NavBar;
