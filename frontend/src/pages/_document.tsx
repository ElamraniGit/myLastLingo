/**
 * FIX BUG-17: Added lang="en" to <Html> for accessibility and SEO.
 */
import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    // FIX BUG-17: Added lang="en" — required for accessibility (WCAG 3.1.1)
    <Html lang="en">
      <Head>
        {/* PWA */}
        <meta name="application-name" content="LinguaLearn" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LinguaLearn" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
