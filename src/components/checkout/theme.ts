export const checkoutColors = {
  canvas: '#F2FAFD', paper: '#FFFFFF', ink: '#0B2936', muted: '#688493',
  cyan: '#08ACE0', cyanDark: '#007CA3', pale: '#E5F6FC', line: '#DEECF2',
  mint: '#E8F8EE', green: '#247447', amber: '#946022', amberPale: '#FFF5E5',
};
export const checkoutMoney = (value: number) => `Rs. ${value.toLocaleString('en-PK')}`;
