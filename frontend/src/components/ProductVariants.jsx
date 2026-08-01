import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { X, Plus } from 'lucide-react';

const ProductVariants = ({ formData, setFormData }) => {
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantValues, setNewVariantValues] = useState({});
  const [newVariantPrices, setNewVariantPrices] = useState({});

  // Defensive: variants may be missing when the form is populated from an
  // existing product, so always fall back to an empty array.
  const variants = Array.isArray(formData.variants) ? formData.variants : [];

  const addVariantType = () => {
    if (!newVariantName.trim()) return;
    
    const newVariants = [
      ...variants,
      { name: newVariantName, values: [] }
    ];
    
    setFormData({ ...formData, variants: newVariants, has_variants: true });
    setNewVariantName('');
  };

  const removeVariantType = (index) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setFormData({ 
      ...formData, 
      variants: newVariants,
      has_variants: newVariants.length > 0
    });
    setNewVariantValues((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const addVariantValue = (variantIndex) => {
    const newVariantValue = (newVariantValues[variantIndex] || '').trim();
    if (!newVariantValue) return;
    const rawPrice = (newVariantPrices[variantIndex] || '').trim();
    const priceDelta = rawPrice === '' ? null : Number(rawPrice);

    const newVariants = variants.map((v, idx) => {
      if (idx !== variantIndex) return v;
      const existing = Array.isArray(v.values) ? v.values : [];
      if (existing.includes(newVariantValue)) return v;
      const prices = { ...(v.prices || {}) };
      if (priceDelta != null && !Number.isNaN(priceDelta) && priceDelta !== 0) {
        prices[newVariantValue] = priceDelta;
      }
      return { ...v, values: [...existing, newVariantValue], prices };
    });

    setFormData({ ...formData, variants: newVariants });
    setNewVariantValues((prev) => ({ ...prev, [variantIndex]: '' }));
    setNewVariantPrices((prev) => ({ ...prev, [variantIndex]: '' }));
  };

  const removeVariantValue = (variantIndex, valueIndex) => {
    const newVariants = variants.map((v, idx) => {
      if (idx !== variantIndex) return v;
      const existing = Array.isArray(v.values) ? v.values : [];
      const removed = existing[valueIndex];
      const prices = { ...(v.prices || {}) };
      if (removed != null) delete prices[removed];
      return { ...v, values: existing.filter((_, i) => i !== valueIndex), prices };
    });

    setFormData({ ...formData, variants: newVariants });
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Product Variants (Optional)</CardTitle>
        <p className="text-sm text-gray-600">Add variations like sizes, colors, materials, etc.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Variant Type */}
        <div>
          <Label>Add Variant Type (e.g., Size, Color)</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="e.g., Size, Color, Material"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantType())}
            />
            <Button type="button" onClick={addVariantType} className="bg-blue-600">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Display Variant Types and Values */}
        {variants.map((variant, variantIndex) => (
          <Card key={variantIndex} className="bg-gray-50">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-lg">{variant.name}</h4>
                <Button
                  type="button"
                  onClick={() => removeVariantType(variantIndex)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Add Values */}
              <div className="mb-3">
                <Label className="text-sm">Add {variant.name} Options</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Input
                    className="flex-1 min-w-[140px]"
                    value={newVariantValues[variantIndex] || ''}
                    onChange={(e) => setNewVariantValues((prev) => ({ ...prev, [variantIndex]: e.target.value }))}
                    placeholder={`e.g., ${variant.name === 'Size' ? 'S, M, L' : variant.name === 'Color' ? 'Black, White' : 'Option 1'}`}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVariantValue(variantIndex);
                      }
                    }}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    step="0.01"
                    value={newVariantPrices[variantIndex] || ''}
                    onChange={(e) => setNewVariantPrices((prev) => ({ ...prev, [variantIndex]: e.target.value }))}
                    placeholder="+ price"
                    title="Optional price adjustment for this option (e.g. 20 or -10)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVariantValue(variantIndex);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => addVariantValue(variantIndex)}
                    size="sm"
                    className="bg-green-600"
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Price is optional — leave blank for no change, or enter e.g. <code>20</code> / <code>-10</code> to adjust this option's price.
                </p>
              </div>

              {/* Display Values */}
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(variant.values) ? variant.values : []).map((value, valueIndex) => {
                  const delta = variant.prices ? variant.prices[value] : undefined;
                  return (
                    <div
                      key={valueIndex}
                      className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border"
                    >
                      <span className="text-sm">{value}</span>
                      {delta != null && Number(delta) !== 0 && (
                        <span className="text-xs font-semibold text-[#a9832f]">
                          {Number(delta) > 0 ? `+$${Number(delta).toFixed(2)}` : `-$${Math.abs(Number(delta)).toFixed(2)}`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeVariantValue(variantIndex, valueIndex)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {variants.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No variants added yet. Add variant types like Size or Color above.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductVariants;
