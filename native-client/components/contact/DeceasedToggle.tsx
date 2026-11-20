import React from 'react';
import { useI18n } from '../../utils/i18n';
import CheckboxRow from './CheckboxRow';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Checkbox marking a contact as deceased; shared by the create and edit forms. */
export default function DeceasedToggle({ value, onChange }: Props) {
  const { t } = useI18n();
  return <CheckboxRow label={t.contacts.deceased} value={value} onChange={onChange} />;
}
