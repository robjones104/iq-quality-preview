'use client';

import { Tooltip, theme } from 'antd';
import { BarcodeOutlined, SignatureOutlined } from '@ant-design/icons';
import { CopyableValue } from './CopyableValue';

// Job number with its provenance icon (Rob 2026-08-05): every SO declares how
// it arrived, barcode for scanned, signature for manually keyed, so the two
// states are explicit rather than marked-vs-unmarked. WOs show neither.
export function JobNoValue({ jobNo, manualEntry }: { jobNo: string; manualEntry?: boolean }) {
  const { token } = theme.useToken();
  const isSO = !jobNo.startsWith('WO');
  const manual = Boolean(manualEntry) && isSO;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {isSO && (manual ? (
        <Tooltip title="SO # entered manually by tech at submission. Verify against the ERP before fulfillment.">
          <SignatureOutlined
            tabIndex={0}
            aria-label="SO number entered manually by tech at submission. Verify against the ERP before fulfillment."
            style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM }}
          />
        </Tooltip>
      ) : (
        <Tooltip title="SO # scanned from the order label at submission.">
          <BarcodeOutlined
            tabIndex={0}
            aria-label="SO number scanned from the order label at submission"
            style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM }}
          />
        </Tooltip>
      ))}
      <CopyableValue value={jobNo} />
    </span>
  );
}
