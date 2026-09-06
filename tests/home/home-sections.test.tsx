import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { ReactElement } from 'react';
import VendorCard from '../../src/components/home/VendorCard';
import FreshProductCard from '../../src/components/home/FreshProductCard';
import SectionHeader from '../../src/components/home/SectionHeader';
import { Rail, RailItem } from '../../src/components/home/rail/Rail';
import { freshPicks, nearbyVendors } from '../../src/data/groceryHome';

const wrap = (ui: ReactElement) =>
  render(<NavigationContainer>{ui}</NavigationContainer>);

test('the vendor rail renders every nearby store with its live status', async () => {
  const view = await wrap(
    <Rail itemWidth={244}>
      {nearbyVendors.map((item, index) => (
        <RailItem key={item.id} index={index}>
          <VendorCard item={item} />
        </RailItem>
      ))}
    </Rail>,
  );

  for (const vendor of nearbyVendors) {
    expect(view.getByText(vendor.name)).toBeTruthy();
    expect(view.getByText(vendor.mark)).toBeTruthy();
  }
  expect(view.getAllByText('Open now')).toHaveLength(3);
  expect(view.getByText('Opens 9:00 AM')).toBeTruthy();
});

test('the add button grows into a working quantity stepper', async () => {
  const view = await wrap(<FreshProductCard item={freshPicks[0]} />);

  expect(view.getByText('Rs. 120')).toBeTruthy();
  expect(view.getByText('Rs. 150')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Add Tomato Organic to cart'));
  expect(view.getByText('1')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Add another Tomato Organic'));
  expect(view.getByText('2')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Remove one Tomato Organic'));
  expect(view.getByText('1')).toBeTruthy();
});

test('a product with no old price shows a single, unstruck price', async () => {
  const plain = freshPicks.find(item => !item.was)!;
  const view = await wrap(<FreshProductCard item={plain} />);

  expect(view.getAllByText(/^Rs\. /)).toHaveLength(1);
  expect(view.getByText(`Rs. ${plain.price}`)).toBeTruthy();
});

test('the section header carries its subtitle and See all action', async () => {
  const onAction = jest.fn();
  const view = await wrap(
    <SectionHeader
      title="Popular near you"
      subtitle="4 stores delivering to your area"
      actionLabel="See all"
      onAction={onAction}
    />,
  );

  expect(view.getByText('4 stores delivering to your area')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('See all, Popular near you'));
  expect(onAction).toHaveBeenCalledTimes(1);
});
