export const PUBLIC_VIEWPORT_PROFILES = {
  compact: {
    minWidth: 320,
    maxWidth: 359,
    gutter: 12,
    sectionPaddingY: 12,
    transactionMaxWidth: 480,
    marketingMaxWidth: 1200,
    modalMaxWidth: 576,
    sheetMaxWidth: 576,
  },
  mobile: {
    minWidth: 360,
    maxWidth: 639,
    gutter: 16,
    sectionPaddingY: 16,
    transactionMaxWidth: 480,
    marketingMaxWidth: 1200,
    modalMaxWidth: 576,
    sheetMaxWidth: 576,
  },
  smallTablet: {
    minWidth: 640,
    maxWidth: 767,
    gutter: 24,
    sectionPaddingY: 24,
    transactionMaxWidth: 480,
    marketingMaxWidth: 1200,
    modalMaxWidth: 576,
    sheetMaxWidth: 576,
  },
  tablet: {
    minWidth: 768,
    maxWidth: 1023,
    gutter: 24,
    sectionPaddingY: 24,
    transactionMaxWidth: 480,
    marketingMaxWidth: 1200,
    modalMaxWidth: 576,
    sheetMaxWidth: 576,
  },
  desktop: {
    minWidth: 1024,
    maxWidth: null,
    gutter: 32,
    sectionPaddingY: 32,
    transactionMaxWidth: 480,
    marketingMaxWidth: 1200,
    modalMaxWidth: 576,
    sheetMaxWidth: 576,
  },
} as const

export const PUBLIC_CONTENT_WIDTHS = {
  transaction: 480,
  list: 720,
  marketing: 1200,
  modal: 576,
  sheet: 576,
} as const

export const PUBLIC_TOUCH_TARGETS = {
  absoluteMinimum: 40,
  recommended: 44,
  fieldMinimum: 48,
} as const

export const PUBLIC_CONTRAST_RATIOS = {
  normalText: 4.5,
  largeText: 3,
  functionalIcon: 3,
  controlBoundary: 3,
  focusIndicator: 3,
} as const

export const PUBLIC_MOTION = {
  micro: 150,
  standard: 200,
  modal: 250,
  sheet: 250,
  landing: 300,
  cover: 720,
} as const

export const PUBLIC_REQUIRED_TEST_WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024] as const

export const PUBLIC_FOUNDATION_CLASSES = {
  container: "public-container",
  transaction: "public-container-transaction",
  list: "public-container-list",
  marketing: "public-container-marketing",
  safeTop: "public-safe-top",
  safeBottom: "public-safe-bottom",
  safeInline: "public-safe-inline",
  focusVisible: "public-focus-visible",
  reducedMotion: "public-reduced-motion",
} as const
