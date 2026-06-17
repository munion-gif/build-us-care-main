import { createElement, Fragment } from "react";

export const builduscareCssVersion = "20260616-react-customer-flow-48";
export const builduscareStylesheets = [
  "/styles/customer/uui-colors.css",
  "/styles/customer/uui-components.css",
  "/styles/customer/board.css",
  "/styles/customer/board-ios26.css",
  "/styles/customer/customer-web.css",
  "/styles/customer/apple-scale.css",
  "/styles/customer/react-overrides.css"
];

export const builduscareStylesheetHrefs = builduscareStylesheets.map((href) => `${href}?v=${builduscareCssVersion}`);

export function BuilduscareStyleLinks() {
  return createElement(
    Fragment,
    null,
    ...builduscareStylesheetHrefs.map((href) =>
      createElement("link", {
        key: href,
        rel: "stylesheet",
        href,
        precedence: "builduscare-customer"
      })
    )
  );
}

export const builduscareCustomerCss = "";
