import {act,fireEvent,render} from '@testing-library/react-native';
import ReceiptExperience from '../../src/components/checkout/receipt/ReceiptExperience';
import {View,Pressable,Text} from 'react-native';
import type {ReceiptOrder} from '../../src/components/checkout/receipt/types';
const mockPrint=jest.fn(async (_options:unknown)=>{});
jest.mock('expo-print',()=>({printAsync:(options:unknown)=>mockPrint(options)}));
jest.mock('../../src/components/checkout/receipt/ReceiptPrinter', () => {
  const { View: MockView, Pressable: MockPressable, Text: MockText } = require('react-native');
  return {
    __esModule: true,
    default: ({ onPrinted, onTorn, phase }: any) => (
      <MockView>
        <MockText>{phase}</MockText>
        <MockPressable accessibilityLabel="Finish printing" onPress={onPrinted} />
        <MockPressable accessibilityLabel="Finish tearing" onPress={onTorn} />
      </MockView>
    ),
  };
});
const order:ReceiptOrder={id:'id',reference:'HM-ABC',createdAt:1,lines:[],subtotal:0,deliveryFee:0,discount:0,total:0,name:'Customer',phone:'03001234567',address:'Address',area:'Area',instructions:'',source:'voice'};

test('receipt actions wait for printing and tearing only changes the visual state',async()=>{
  const onDone=jest.fn(),onTrack=jest.fn();
  const screen=await render(<ReceiptExperience order={order} onTrack={onTrack} onDone={onDone}/>);
  expect(screen.queryByRole('button',{name:'Tear It'})).toBeNull();
  await fireEvent.press(screen.getByLabelText('Finish printing'));
  await fireEvent.press(screen.getByRole('button',{name:'Tear It'}));
  expect(screen.getByText('tearing')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Tear It'})).toBeNull();
  expect(onDone).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Finish tearing'));
  await fireEvent.press(screen.getByRole('button',{name:'Track Order'}));
  expect(onTrack).toHaveBeenCalledTimes(1);
  expect(order.reference).toBe('HM-ABC');
});

test('native print uses the saved receipt and remains available after an error',async()=>{
  mockPrint.mockRejectedValueOnce(new Error('printer unavailable'));
  const screen=await render(<ReceiptExperience order={order} onTrack={()=>{}} onDone={()=>{}}/>);
  await fireEvent.press(screen.getByLabelText('Finish printing'));
  await act(async()=>{await fireEvent.press(screen.getByRole('button',{name:'Print Receipt'}));});
  expect(mockPrint.mock.calls[0][0]).toEqual(expect.objectContaining({html:expect.stringContaining('HM-ABC')}));
  expect(screen.getByText("Couldn't open printing. Please try again.")).toBeTruthy();
  expect(screen.getByRole('button',{name:'Print Receipt'})).toBeTruthy();
});
