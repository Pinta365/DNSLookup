import { define } from "../utils.ts";
import "../assets/styles.css";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <title>DNS Lookup</title>
      </head>
      <body class="antialiased">
        <Component />
      </body>
    </html>
  );
});
