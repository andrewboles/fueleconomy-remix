import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import styles from './styles/global.css'

export function links(){
  return [{ rel: "stylesheet", href: styles}]
}

export const meta = () => ({
  charset: "utf-8",
  title: "Fuel Econ Data Processing",
  viewport: "width=device-width,initial-scale=1",
});


export default function App() {

  
  return (
    <html lang="en">
      <head>
      <link href='https://api.mapbox.com/mapbox-gl-js/v2.7.0/mapbox-gl.css' rel='stylesheet' />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
