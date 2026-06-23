'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { theme, Grid, Button, Drawer, Menu } from 'antd';
import { MenuOutlined, MoonFilled, SunFilled } from '@ant-design/icons';
import { useThemeStore } from '@/store/themeStore';
import { NAV_TOP, NAV_MANAGE, NAV_BOTTOM } from '@/lib/nav';

const { useBreakpoint } = Grid;

type Props = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
};

export function PageHeader({ left, center, right }: Props) {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const { darkMode, toggle } = useThemeStore();

  const close = () => setMobileNavOpen(false);

  // Resolve active key from current pathname
  const allNavItems = [...NAV_TOP, ...NAV_MANAGE, ...NAV_BOTTOM];
  const activeKey =
    allNavItems.find((item) =>
      item.href === '/dashboard'
        ? pathname === '/' || pathname === '/dashboard'
        : pathname.startsWith(item.href)
    )?.href ?? '';

  const menuItems = [
    ...NAV_TOP.map((item) => ({
      key: item.href,
      label: <Link href={item.href} onClick={close}>{item.label}</Link>,
    })),
    {
      key: 'manage',
      label: 'Manage Lists',
      children: NAV_MANAGE.map((item) => ({
        key: item.href,
        label: <Link href={item.href} onClick={close}>{item.label}</Link>,
      })),
    },
    { type: 'divider' as const },
    ...NAV_BOTTOM.map((item) => ({
      key: item.href,
      label: <Link href={item.href} onClick={close}>{item.label}</Link>,
    })),
    { type: 'divider' as const },
    {
      key: 'theme-toggle',
      label: (
        <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {darkMode ? <SunFilled /> : <MoonFilled />}
          {darkMode ? 'Switch to Light' : 'Switch to Dark'}
        </div>
      ),
    },
  ];

  return (
    <>
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Left: hamburger (mobile only) + page-contextual content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          {!screens.md && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileNavOpen(true)}
              style={{ flexShrink: 0 }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {left}
          </div>
        </div>

        {/* Center: optional search or contextual content */}
        {center && (
          <div style={{ width: 280, flexShrink: 0 }}>{center}</div>
        )}

        {/* Right: page-contextual actions */}
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>

      {/* Mobile navigation drawer */}
      <Drawer
        title={
          <svg width="201" height="26" viewBox="0 0 1766 227" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="iQ Quality">
            <path d="M746.75 9.3569C748.779 9.18501 750.815 9.12361 752.85 9.17289C848.623 11.4 884.213 123.833 817.963 186.552C824.989 193.857 832.995 204.136 839.529 212.128C834.409 216.364 829.323 220.642 824.272 224.96C818.327 218.253 808.636 205.032 801.709 198.683C800.884 197.926 797.952 199.523 796.529 200.127C785.235 205.315 773.13 208.515 760.747 209.587C629.836 221.172 608.378 20.6296 746.75 9.3569ZM763.986 190.221C808.746 183.535 839.521 141.702 832.585 96.9744C825.648 52.2467 783.649 21.7031 738.967 28.8919C694.639 36.0237 664.393 77.6241 671.275 121.998C678.157 166.372 719.582 196.855 763.986 190.221Z" fill={token.colorText} />
            <path d="M444.209 9.36341C448.213 8.85582 454.793 9.23703 458.958 9.65225C552.008 18.9285 579.656 133.134 510.504 190.281C515.312 195.559 526.418 208.772 530.214 214.357C525.123 218.486 520.009 222.585 514.872 226.656C510.449 221.67 496.895 203.902 492.518 200.835C481.256 205.668 469.283 208.642 457.068 209.64C326.195 220.028 306.693 19.8308 444.209 9.36341ZM461.507 190.195C506.13 183.398 536.764 141.667 529.883 97.0506C523.002 52.4338 481.22 21.8741 436.622 28.8396C392.143 35.7865 361.687 77.4401 368.549 121.938C375.412 166.436 417.002 196.976 461.507 190.195Z" fill={token.colorText} />
            <path d="M1140.43 14.1716L1159.35 14.1922C1168.99 33.9927 1180.2 62.4126 1189.12 83.1452L1241.34 204.971L1219.75 205.04C1213.46 188.724 1205.49 171.194 1198.87 154.716C1189.17 155.403 1169.46 154.78 1159.03 154.778L1100.06 154.829L1079.28 204.929L1057.98 205.038C1066.13 184.258 1077.27 160.101 1086.29 139.243L1140.43 14.1716ZM1107.32 137.136L1150.06 137.164L1191.52 137.194C1186.93 126.073 1152.26 39.8631 1149.04 36.5003L1107.32 137.136Z" fill={token.colorText} />
            <path d="M1455.26 14.0691C1510.5 15.4286 1571.35 14.1702 1627.04 14.1891C1633.01 22.6209 1641.01 36.3907 1646.63 45.4361L1684.6 106.401L1742.53 14.166L1765.14 14.2169C1743.57 49.2282 1716.76 87.897 1693.9 122.642C1693.17 147.309 1693.31 180.33 1694.05 205.006C1688.79 205.077 1680.36 205.853 1675.9 204.358C1673.9 202.213 1674.47 201.996 1674.23 198.583L1674.21 122.934C1653.07 87.7516 1625.21 49.3922 1602.76 13.7802L1602.84 31.4558L1538.72 31.4699C1539.25 46.8493 1538.65 63.8308 1538.78 79.4435C1539.14 121.156 1538.2 163.348 1539.03 205.014L1519.29 204.963C1518.28 148.318 1519.13 88.3297 1519.3 31.4316L1455.25 31.473C1454.94 26.1282 1455.2 19.5122 1455.26 14.0691Z" fill={token.colorText} />
            <path d="M1014.63 14.1085L1033.99 14.1732L1034.03 31.8559L1034.04 133.169C1033.84 154.417 1028.27 176.522 1012.74 191.87C987.87 216.404 935.485 216.07 911.172 191.043C886.77 165.917 890.863 127.239 890.863 94.8776C890.782 67.9615 890.863 41.0454 891.096 14.1304L910.787 14.1716C910.096 40.2677 910.885 65.8217 910.67 93.0644C910.087 133.026 904.818 191.124 960.676 192.311C1017.69 193.522 1014.94 139.573 1014.45 99.2542C1014.11 70.9487 1013.95 41.8901 1014.63 14.1085Z" fill={token.colorText} />
            <path d="M105.864 35.9059C130.269 41.8846 149.471 54.477 162.667 76.2723C174.739 96.2284 178.366 120.173 172.747 142.81C169.789 154.679 163.428 167.296 155.717 176.835L180.6 201.598L156.037 226.159C146.836 217.242 137.769 208.185 128.84 198.994C120.814 202.991 114.806 205.283 105.856 207.146L105.709 171.18C120.736 163.9 131.593 155.128 137.315 138.683C141.911 125.443 141.056 110.919 134.936 98.3117C128.464 85.0714 119.032 77.6034 105.848 71.7799C105.804 60.2889 105.456 47.2799 105.864 35.9059Z" fill={darkMode ? '#FED20C' : '#36383D'} />
            <path d="M69.9555 35.9248L70.1188 71.472C56.5034 77.5846 47.3029 84.4018 40.4323 98.2166C34.146 110.707 33.1419 125.199 37.6458 138.438C43.4887 155.75 54.6071 163.95 70.056 171.564L70.0865 207.412C59.9775 204.76 54.7588 203.391 45.375 198.293C43.0223 197.023 40.7377 195.632 38.5305 194.123C19.2467 181.167 5.94319 161.038 1.58234 138.217C-2.86629 115.026 2.15411 91.0188 15.5228 71.5546C28.1453 52.8476 47.7625 40.0068 69.9555 35.9248Z" fill={darkMode ? '#FED20C' : '#36383D'} />
            <path d="M1269.69 14.0879L1288.98 14.1734L1288.95 187.6C1318.05 188.224 1349.05 187.703 1378.3 187.705L1378.43 204.95L1269.73 205.04C1268.34 164.061 1270.17 121.99 1269.47 80.8967C1269.1 58.9506 1269.22 35.9975 1269.69 14.0879Z" fill={token.colorText} />
            <path d="M1407.17 14.09L1426.94 14.1709C1425.61 75.2993 1426.74 143.603 1426.93 204.99L1407.2 204.974C1406.43 141.899 1407.16 77.2893 1407.17 14.09Z" fill={token.colorText} />
            <path d="M288.565 67.7775C295.004 67.7847 301.441 67.7057 307.877 67.5397L307.944 204.59C305.217 205.224 291.695 205.04 288.056 205.044C287.185 175.61 288.324 144.394 287.821 114.786C287.695 107.329 287.43 73.1658 288.565 67.7775Z" fill={token.colorText} />
            <path d="M69.7868 0.036442L105.983 0C105.96 10.8855 106.314 25.2705 105.864 35.9059C93.171 33.086 82.5541 34.1236 69.9555 35.9248C69.8092 23.9626 69.7527 11.9995 69.7868 0.036442Z" fill={darkMode ? '#FED20C' : '#36383D'} />
            <path d="M295.802 1.23942C303.384 0.100019 310.467 5.28998 311.666 12.8645C312.866 20.4391 307.732 27.5634 300.169 28.8226C292.52 30.0961 285.299 24.8919 284.086 17.2321C282.874 9.57238 288.134 2.39166 295.802 1.23942Z" fill={token.colorText} />
          </svg>
        }
        open={mobileNavOpen}
        onClose={close}
        placement="left"
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          defaultOpenKeys={['manage']}
          items={menuItems}
          style={{ border: 'none', height: '100%' }}
        />
      </Drawer>
    </>
  );
}
