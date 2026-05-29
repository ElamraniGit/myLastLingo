import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" dir="ltr" className="dark">
      <Head>
        <meta name="application-name" content="LinguaLearn" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LinguaLearn" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-navbutton-color" content="#0f172a" />
        <meta name="msapplication-starturl" content="/" />
        <link rel="manifest" href="/manifest.json" />
        {/* Fix: use .svg since that's the actual file format available */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192x192.svg" />
      </Head>
      <body className="bg-base text-heading min-h-screen">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
