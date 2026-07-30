import Footer from '../components/Footer';
import { useSeo } from '../lib/seo';

const RefundPolicy = () => {
  useSeo({
    title: 'Refund & Return Policy',
    description:
      'Kayee01 Refund & Return Policy: 30-day returns, quality guarantee, color/size exchanges, refund methods and timelines for jewelry, watches and accessories.',
    keywords: ['refund policy', 'return policy', 'exchange', 'money back guarantee', 'jewelry returns'],
  });
  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }}>
            Refund & Return Policy
          </h1>
          <p className="text-gray-600 mb-8">
            This policy applies to all Kayee01 orders — jewelry (necklaces, rings, bracelets,
            earrings and brooches), watches and accessories. Please read the conditions below
            before requesting a return or refund.
          </p>
          
          <div className="prose prose-lg max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-bold mb-4">Our Commitment to Quality</h2>
              <p className="text-gray-700 leading-relaxed">
                We stand behind the quality of our products. Every item undergoes strict quality control before shipping to ensure it meets our high standards. Customer satisfaction is our priority.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">30-Day Return Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We offer a 30-day return policy from the date of delivery. If you are not satisfied with your purchase, you may return the item for a refund or exchange under the following conditions:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Item must be unused and in original condition</li>
                <li>All original packaging and accessories must be included</li>
                <li>Tags and labels must remain attached</li>
                <li>No signs of wear or damage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Quality Guarantee</h2>
              <p className="text-gray-700 leading-relaxed">
                We guarantee that all products will match the quality shown in product photos. If your item differs significantly from what was advertised, you are eligible for:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>Full Refund:</strong> 100% money back if product quality is not as described</li>
                <li><strong>Free Replacement:</strong> We'll send a replacement at no additional cost</li>
                <li><strong>Partial Refund:</strong> For minor discrepancies, we offer partial refunds</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Return Process</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Step 1: Contact Us</h3>
                  <p className="text-gray-700">Contact our customer service via WhatsApp or email within 30 days of delivery. Provide your order number and reason for return.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Step 2: Return Authorization</h3>
                  <p className="text-gray-700">We will review your request and provide a Return Authorization (RA) number along with return shipping instructions.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Step 3: Ship the Item</h3>
                  <p className="text-gray-700">Securely package the item with all original accessories and ship it back using a trackable shipping method.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Step 4: Refund Processing</h3>
                  <p className="text-gray-700">Once we receive and inspect the returned item, we will process your refund within 5-7 business days.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Shipping Costs for Returns</h2>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>Defective/Wrong Item:</strong> We cover all return shipping costs</li>
                <li><strong>Quality Issues:</strong> We provide a prepaid shipping label</li>
                <li><strong>Change of Mind:</strong> Customer responsible for return shipping costs</li>
                <li><strong>Lost in Transit:</strong> Full refund if package is lost during return shipment (with tracking)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Refund Methods</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Refunds will be issued to the original payment method:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>Credit/Debit Card:</strong> 5-7 business days</li>
                <li><strong>PayPal:</strong> 3-5 business days</li>
                <li><strong>Cryptocurrency:</strong> 2-3 business days</li>
                <li><strong>Store Credit:</strong> Immediate (110% of original value)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Non-Returnable Items</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                The following items cannot be returned:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Items worn or showing signs of use</li>
                <li>Items without original packaging</li>
                <li>Items damaged by customer</li>
                <li>Custom-made or personalized items</li>
                <li>Items returned after 30 days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Exchanges (Color / Size / Model)</h2>
              <p className="text-gray-700 leading-relaxed">
                If you need to exchange an item for a different <strong>size</strong>, <strong>color</strong>, or model, please contact us within 30 days of delivery and include your order number and the option you selected at checkout. Exchanges are subject to product availability. We will cover shipping costs for exchanges due to defects or errors on our part; for change-of-preference exchanges the customer covers return shipping.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Damaged or Defective Items</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you receive a damaged or defective item:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Contact us within 48 hours of delivery</li>
                <li>Provide photos of the damage/defect</li>
                <li>We will arrange immediate replacement or full refund</li>
                <li>No need to return the defective item in most cases</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Lost or Stolen Packages</h2>
              <p className="text-gray-700 leading-relaxed">
                If your package is marked as delivered but you haven't received it:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Check with neighbors or building management</li>
                <li>Contact us within 24 hours</li>
                <li>We will investigate with the carrier</li>
                <li>Full refund or replacement if package cannot be located</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Customs and Import Issues</h2>
              <p className="text-gray-700 leading-relaxed">
                If your package is held or seized by customs, please contact us immediately. We will work with you to resolve the issue or provide a full refund if the package cannot be delivered.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                For any questions about returns or refunds, our customer service team is available 24/7 via WhatsApp. We typically respond within 2-4 hours.
              </p>
            </section>

            <div className="mt-12 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
              <h3 className="text-xl font-bold mb-3 text-green-800">Our Promise</h3>
              <p className="text-gray-700">
                We are committed to your complete satisfaction. If you have any concerns about your purchase, please reach out to us. We will do everything possible to make it right.
              </p>
            </div>

            <div className="mt-6 p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Last Updated:</strong> July 2026
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RefundPolicy;