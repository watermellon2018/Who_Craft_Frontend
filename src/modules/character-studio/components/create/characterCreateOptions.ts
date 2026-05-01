export const characterTypeOptions = [
  {value: 'human', label: 'Человек'},
  {value: 'animal', label: 'Животное'},
  {value: 'creature', label: 'Существо'},
  {value: 'robot', label: 'Робот'},
  {value: 'object', label: 'Объект'},
  {value: 'other', label: 'Другое'},
];

export const genderApplicabilityOptions = [
  {value: 'female', label: 'Женский'},
  {value: 'male', label: 'Мужской'},
  {value: 'other', label: 'Нет'},
];

export const roleOptions = [
  {value: 'main', label: 'Главный герой'},
  {value: 'secondary', label: 'Второстепенный персонаж'},
  {value: 'antagonist', label: 'Антагонист'},
  {value: 'episodic', label: 'Эпизодический'},
  {value: 'cameo', label: 'Камео'},
];

export const roleLabelMap: Record<string, string> = Object.fromEntries(
  roleOptions.map(({value, label}) => [value, label]),
);
