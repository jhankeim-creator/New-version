import { getDisplaySalesCount } from '../lib/orderRules';

const SoldCountBadge = ({ product, className = '' }) => {
  const count = getDisplaySalesCount(product);
  if (!count) return null;

  return (
    <p className={`text-xs text-gray-500 ${className}`.trim()} data-testid="sold-count">
      {count} sold
    </p>
  );
};

export default SoldCountBadge;
