'use client';

import { Checkbox, Col, Form, Input, InputNumber, Radio, Row, Select, Slider, Typography, theme } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import type { FormInstance } from 'antd';
import { eligibleParts } from '@/data/partsCatalog';

const { Text } = Typography;

// Quantity semantics follow the unit (Rob 2026-08-05): Piece counts in whole
// units, Length in quarter increments.
export function quantityProps(quantityType?: string) {
  return quantityType === 'Length'
    ? { min: 0.25, step: 0.25, precision: 2 }
    : { min: 1, step: 1, precision: 0 };
}

const SLIDER_PROPS: Record<'Piece' | 'Length', { min: number; max: number; step: number; marks: Record<number, string> }> = {
  Piece:  { min: 1,    max: 100, step: 1,    marks: { 1: '1', 25: '25', 50: '50', 75: '75', 100: '100' } },
  Length: { min: 0.25, max: 50,  step: 0.25, marks: { 0.25: '0.25', 12.5: '12.5', 25: '25', 50: '50' } },
};

// Slider + number pair (the "timeline", Rob 2026-08-05), unit-aware: Piece
// slides whole units, Length quarter units. Bound to the form value so either
// control moves the other.
export function QuantitySliderField({ form, name, label = 'Quantity', style }: {
  form: FormInstance;
  name: NamePath;
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Form.Item noStyle shouldUpdate>
      {({ getFieldValue }) => {
        const qt: 'Piece' | 'Length' = getFieldValue(Array.isArray(name) ? [...name.slice(0, -1), 'quantityType'] : 'quantityType') === 'Length' ? 'Length' : 'Piece';
        const sp = SLIDER_PROPS[qt];
        const value: number = getFieldValue(name) ?? sp.min;
        return (
          <Form.Item label={label} style={{ marginBottom: 0, ...style }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Slider
                  min={sp.min} max={sp.max} step={sp.step} marks={sp.marks}
                  value={value}
                  onChange={(v: number) => form.setFieldValue(name, v)}
                />
              </div>
              <InputNumber
                {...quantityProps(qt)}
                max={sp.max}
                value={value}
                onChange={(v) => form.setFieldValue(name, v ?? sp.min)}
                style={{ width: 84 }}
                aria-label={label}
              />
            </div>
            <Form.Item name={name} noStyle rules={[{ required: true, message: 'Qty' }]}>
              <Input type="hidden" />
            </Form.Item>
          </Form.Item>
        );
      }}
    </Form.Item>
  );
}

/** Snap an existing value onto the new unit's grid when the type flips. */
export function snapQuantity(value: number | undefined, quantityType: string): number {
  const v = value ?? 1;
  return quantityType === 'Length' ? Math.max(0.25, Math.round(v * 4) / 4) : Math.max(1, Math.round(v));
}

// The one Add-a-Part field cluster (intake's pattern, promoted app-wide):
// a contextual catalog select scoped by door + component, a "Part not listed"
// escape hatch to manual entry, and unit-aware quantity fields. Field names
// are fixed (partNumber, partDescription, partManual, quantityType, quantity)
// so every caller's submit handler reads the same shape.
export function PartPickerFields({ form, door, component }: {
  form: FormInstance;
  door?: string;
  component?: string;
}) {
  const { token } = theme.useToken();
  const catalog = eligibleParts(door, component);

  return (
    <>
      <Form.Item noStyle shouldUpdate={(p, c) => p.partManual !== c.partManual}>
        {({ getFieldValue }) => {
          const manual: boolean = getFieldValue('partManual') ?? false;
          return manual ? (
            <Row gutter={8}>
              <Col flex={1}>
                <Form.Item label="Part #" name="partNumber" rules={[{ required: true, message: 'Part number' }]} style={{ marginBottom: 10 }}>
                  <Input placeholder="Part number" />
                </Form.Item>
              </Col>
              <Col flex={2}>
                <Form.Item label="Part Description" name="partDescription" rules={[{ required: true, message: 'Part description' }]} style={{ marginBottom: 10 }}>
                  <Input placeholder="Describe the part" />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <>
            <Form.Item label="Part" name="partNumber" rules={[{ required: true, message: 'Select a part' }]} style={{ marginBottom: 10 }}>
              <Select
                showSearch
                placeholder={door && component ? 'Select a part that fits this door and component' : 'Select a part'}
                optionFilterProp="label"
                options={catalog.map(p => ({ value: p.partNumber, label: `${p.partNumber} · ${p.partDescription}` }))}
                onChange={(v: string) => {
                  const m = catalog.find(p => p.partNumber === v);
                  if (m) form.setFieldValue('partDescription', m.partDescription);
                }}
              />
            </Form.Item>
              <Form.Item name="partDescription" hidden>
                <Input type="hidden" />
              </Form.Item>
            </>
          );
        }}
      </Form.Item>
      <Form.Item name="partManual" valuePropName="checked" style={{ marginBottom: 10 }}>
        <Checkbox onChange={() => form.setFieldsValue({ partNumber: undefined, partDescription: undefined })}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Part not listed</Text>
        </Checkbox>
      </Form.Item>
      <Form.Item label="Quantity Type" name="quantityType" rules={[{ required: true, message: 'Type' }]} style={{ marginBottom: 10 }}>
        <Radio.Group
          buttonStyle="solid"
          size="small"
          onChange={e => form.setFieldValue('quantity', snapQuantity(form.getFieldValue('quantity'), e.target.value))}
        >
          <Radio.Button value="Piece">Piece</Radio.Button>
          <Radio.Button value="Length">Length</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <QuantitySliderField form={form} name="quantity" />
    </>
  );
}
