import type {TFunction} from 'i18next';

const CHARACTER_TYPE_VALUES = ['human', 'animal', 'creature', 'robot', 'object', 'other'] as const;
const GENDER_VALUES = ['female', 'male', 'other'] as const;
const ROLE_VALUES = ['main', 'secondary', 'antagonist', 'episodic', 'cameo'] as const;

const toOptions = (values: readonly string[], prefix: string, t: TFunction) => (
  values.map((value) => ({value, label: t(`${prefix}.${value}`)}))
);

export const getCharacterTypeOptions = (t: TFunction) => toOptions(
  CHARACTER_TYPE_VALUES,
  'characterStudio.options.characterType',
  t,
);

export const getGenderApplicabilityOptions = (t: TFunction) => toOptions(
  GENDER_VALUES,
  'characterStudio.options.gender',
  t,
);

export const getRoleOptions = (t: TFunction) => toOptions(
  ROLE_VALUES,
  'characterStudio.options.role',
  t,
);

export const getRoleLabel = (role: string, t: TFunction) => (
  ROLE_VALUES.includes(role as typeof ROLE_VALUES[number])
    ? t(`characterStudio.options.role.${role}`)
    : role
);
