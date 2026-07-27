'use client';

import { Tooltip, theme } from 'antd';
import { SignatureOutlined } from '@ant-design/icons';
import { CopyableValue } from './CopyableValue';

// Job number with its provenance flag: a manually keyed SO number carries an
// icon ahead of the copyable value (scanned is the normal path and stays
// unmarked). WOs never show the flag.
export function JobNoValue({ jobNo, manualEntry }: { jobNo: string; manualEntry?: boolean }) {
  const { token } = theme.useToken();
  const flagged = Boolean(manualEntry) && !jobNo.startsWith('WO');

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {flagged && (
        <Tooltip title="SO # entered manually by tech at submission. Verify against the ERP before fulfillment.">
          <SignatureOutlined style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      <CopyableValue value={jobNo} />
    </span>
  );
}
