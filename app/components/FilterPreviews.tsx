import { Text, RadioButton, Checkbox, Box, InlineStack, BlockStack, Select } from "@shopify/polaris";
import type { FilterSettings } from "../types";
import React from "react";

interface PreviewProps {
  settings: FilterSettings;
  values?: string[];
}

const SAMPLE_OPTIONS = [
  { label: 'Roșu ( 12 )', color: '#ff0000', value: 'rosu' },
  { label: 'Verde ( 2 )', color: '#00ff00', value: 'verde' },
  { label: 'Albastru ( 3 )', color: '#0000ff', value: 'albastru' }
];

const SAMPLE_VALUES = [
  'Opțiunea 1 (12)',
  'Opțiunea 2 (8)',
  'Opțiunea 3 (5)',
  'Opțiunea 4 (3)',
  'Opțiunea 5 (2)',
  'Opțiunea 6 (1)',
  'Opțiunea 7 (1)',
  'Opțiunea 8 (1)'
];

function getTransformedText(text: string, transform?: FilterSettings['textTransform']) {
  switch (transform) {
    case 'capitalize':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    default:
      return text;
  }
}

function FilterValuesContainer({ children, settings }: { children: React.ReactNode, settings: FilterSettings }) {
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  if (settings.displayMode === 'scrollbar') {
    return (
      <div style={{
        ...style,
        maxHeight: '200px',
        overflowY: 'auto',
        padding: '4px'
      }}>
        {children}
      </div>
    );
  }

  return <div style={style}>{children}</div>;
}

function CheckboxPreview({ settings, values = SAMPLE_VALUES }: PreviewProps) {
  const [showAll, setShowAll] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const displayValues = settings.displayMode === 'show_more' && !showAll ? values.slice(0, 6) : values;
  const showMoreButton = settings.displayMode === 'show_more' && values.length > 6;

  const filteredValues = displayValues.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FilterValuesContainer settings={settings}>
      {settings.hasSearchbox && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Caută în filtru..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
      )}
      {filteredValues.map((value, index) => (
        <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" />
          <span>{getTransformedText(value, settings.textTransform)}</span>
        </label>
      ))}
      {showMoreButton && !searchTerm && (
        <button 
          onClick={() => setShowAll(prev => !prev)}
          style={{
            border: 'none',
            background: 'none',
            color: '#2c6ecb',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          {showAll ? 'Show Less' : `Show More (${values.length - 6} more)`}
        </button>
      )}
    </FilterValuesContainer>
  );
}

function RadioPreview({ settings, values = SAMPLE_VALUES }: PreviewProps) {
  const [showAll, setShowAll] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const displayValues = settings.displayMode === 'show_more' && !showAll ? values.slice(0, 6) : values;
  const showMoreButton = settings.displayMode === 'show_more' && values.length > 6;

  const filteredValues = displayValues.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FilterValuesContainer settings={settings}>
      {settings.hasSearchbox && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Caută în filtru..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
      )}
      {filteredValues.map((value, index) => (
        <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="radio" name="radio-group" />
          <span>{getTransformedText(value, settings.textTransform)}</span>
        </label>
      ))}
      {showMoreButton && !searchTerm && (
        <button 
          onClick={() => setShowAll(prev => !prev)}
          style={{
            border: 'none',
            background: 'none',
            color: '#2c6ecb',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          {showAll ? 'Show Less' : `Show More (${values.length - 6} more)`}
        </button>
      )}
    </FilterValuesContainer>
  );
}

export const RangePreview = () => (
  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">Exemplu filtru range:</Text>
      <div style={{ padding: '10px 0' }}>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value="50" 
          disabled 
          style={{ width: '100%' }}
        />
      </div>
      <InlineStack align="space-between">
        <Text as="span" variant="bodyMd">0</Text>
        <Text as="span" variant="bodyMd">100</Text>
      </InlineStack>
    </BlockStack>
  </Box>
);

export const ColorPreview: React.FC<PreviewProps> = ({ settings }) => (
  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">Exemplu filtru culoare:</Text>
      <InlineStack gap="200">
        {SAMPLE_OPTIONS.map(option => (
          <div
            key={option.label}
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: option.color,
              borderRadius: '28px',
              border: '2px solid #ddd',
              cursor: 'pointer'
            }}
            title={getTransformedText(option.label, settings.textTransform)}
          />
        ))}
      </InlineStack>
    </BlockStack>
  </Box>
);

export const SwatchTextPreview: React.FC<PreviewProps> = ({ settings }) => (
  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">Exemplu filtru swatch-text:</Text>
      <InlineStack gap="200">
        {SAMPLE_OPTIONS.map(option => (
          <div
            key={option.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: settings.swatchSize.split('x')[0] + 'px',
                height: settings.swatchSize.split('x')[1] + 'px',
                backgroundColor: option.color,
                borderRadius: settings.swatchMode === 'circle' ? '50%' : '4px',
                border: '2px solid #ddd'
              }}
            />
            <Text as="span" variant="bodyMd">{getTransformedText(option.label, settings.textTransform)}</Text>
          </div>
        ))}
      </InlineStack>
    </BlockStack>
  </Box>
);

export const DropdownPreview: React.FC<PreviewProps> = ({ settings }) => (
  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">Exemplu filtru dropdown:</Text>
      <Select
        label=""
        options={[
          { label: getTransformedText('Toate', settings.textTransform), value: '' },
          ...SAMPLE_OPTIONS.map(option => ({
            label: getTransformedText(option.label, settings.textTransform),
            value: option.value
          }))
        ]}
        value=""
        disabled
      />
    </BlockStack>
  </Box>
);

export const FilterPreview: React.FC<PreviewProps> = ({ settings, values = SAMPLE_VALUES }) => {
  switch (settings.displayType) {
    case 'checkbox':
      return <CheckboxPreview settings={settings} values={values} />;
    case 'radio':
      return <RadioPreview settings={settings} values={values} />;
    case 'range':
      return <RangePreview />;
    case 'color':
      return <ColorPreview settings={settings} />;
    case 'swatch-text':
      return <SwatchTextPreview settings={settings} />;
    case 'dropdown':
      return <DropdownPreview settings={settings} />;
    default:
      return <CheckboxPreview settings={settings} values={values} />;
  }
}; 