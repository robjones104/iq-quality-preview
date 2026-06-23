import type { FontMapToken } from 'antd/es/theme/interface/maps/font';

declare module 'antd/es/theme/interface/maps/font' {
  interface FontMapToken {
    /** Extra-small font size — seed fontSize - 4 (10px at 1920, 13px at 2560) */
    fontSizeXS: number;
  }
}
