/** Vendor fingerprints: analytics, consent tools, call tracking, CRM, booking, chat, reviews, builders. */
export const DETECT = {
  analytics: { "Google Analytics 4": /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/, "Google Tag Manager": /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/, "Universal Analytics": /google-analytics\.com\/analytics\.js|UA-\d{4,}-\d/, "Meta Pixel": /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/, "Microsoft Clarity": /clarity\.ms\/tag/, Hotjar: /static\.hotjar\.com/ },
  consent: { Cookiebot: /cookiebot/i, OneTrust: /onetrust|optanon/i, CookieYes: /cookieyes|cookie-law-info/i, Termly: /termly\.io/i, iubenda: /iubenda/i, Osano: /osano/i, Complianz: /complianz|cmplz/i, "Consent banner (generic)": /cookie[-_ ]?(consent|banner|notice)|accept (all )?cookies/i },
  callTracking: { CallRail: /callrail/i, CallTrackingMetrics: /calltrackingmetrics|tctm\.co/i, WhatConverts: /whatconverts/i },
  fsm: { Jobber: /getjobber\.com|clienthub\.getjobber|jobber/i, "Housecall Pro": /housecallpro/i, ServiceTitan: /servicetitan/i },
  crm: { "GoHighLevel / LeadConnector": /leadconnectorhq|msgsndr|gohighlevel|link\.msgsndr/i, HubSpot: /js\.hs-scripts\.com|hsforms|hubspot/i },
  booking: { Calendly: /calendly\.com/i, Jobber: /clienthub\.getjobber|getjobber\.com\/.*request/i, "Housecall Pro": /book\.housecallpro|housecallpro\.com\/book/i, ServiceTitan: /servicetitan.*(scheduler|schedul)/i, "LeadConnector calendar": /leadconnectorhq\.com\/widget\/booking|msgsndr.*calendar/i },
  chat: { Podium: /podium\.com/i, Birdeye: /birdeye/i, "tawk.to": /tawk\.to/i, Intercom: /intercom/i, Drift: /drift\.com/i, LiveChat: /livechatinc/i, "LeadConnector chat": /leadconnectorhq\.com\/.*chat|chat-widget/i, "Facebook Messenger": /customerchat/i },
  reviews: { Elfsight: /elfsight/i, Trustindex: /trustindex/i, Birdeye: /birdeye/i, Podium: /podium/i, "Google reviews embed": /google.*reviews?.*widget|grw-/i, Trustpilot: /trustpilot/i, HomeStars: /homestars/i },
  carousel: { Swiper: /swiper/i, Slick: /slick(-slider|\.min|-carousel)|class=["'][^"']*\bslick\b/i, Owl: /owl-carousel/i, Flickity: /flickity/i, Splide: /splide/i, "Revolution Slider": /revslider|rev_slider/i, "Generic carousel": /class=["'][^"']*\b(carousel|slider|hero-slider)\b/i },
  builder: { Wix: /static\.wixstatic|wix\.com|_wixCIDX/i, Squarespace: /squarespace/i, WordPress: /wp-content|wp-includes/i, "GoDaddy builder": /img1\.wsimg\.com|godaddy/i, Weebly: /weebly/i, Duda: /dudaone|multiscreensite/i, Webflow: /webflow/i, Shopify: /cdn\.shopify/i, "Next.js": /\/_next\/static/i },
};
export const detect = (hay, group) => Object.entries(DETECT[group]).filter(([, re]) => re.test(hay)).map(([k]) => k);
