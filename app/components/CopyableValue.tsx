'use client';

import { useState } from 'react';
import { theme } from 'antd';
import { CheckOutlined, CopyFilled } from '@ant-design/icons';

export function CopyableValue({ value }: { value: string }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const { token } = theme.useToken();

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      onClick={handleCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 6px',
        borderRadius: token.borderRadiusSM,
        background: hovered ? token.colorFillSecondary : token.colorFillTertiary,
        fontFamily: 'monospace',
        fontSize: token.fontSize,
        color: token.colorText,
        cursor: 'copy',
        transition: 'background 0.15s',
        userSelect: 'none',
      }}
    >
      {value}
      <span style={{
        fontSize: token.fontSizeSM,
        color: copied ? token.colorSuccess : token.colorTextTertiary,
        opacity: hovered || copied ? 1 : 0,
        transition: 'opacity 0.15s',
        display: 'flex',
        alignItems: 'center',
      }}>
        {copied ? <CheckOutlined /> : <CopyFilled />}
      </span>
    </span>
  );
}
