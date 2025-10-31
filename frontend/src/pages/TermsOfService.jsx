import Footer from '../components/Footer';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }}>
            Terms of Service
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Product Disclaimer</h2>
              <p className="text-gray-700 leading-relaxed">
                All products sold on this website are fashion items intended for personal use only. We offer high-quality fashion watches, jewelry, clothing and accessories at affordable prices.
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Products are carefully selected for quality and style</li>
                <li>We offer designer-style fashion at accessible prices</li>
                <li>All product descriptions provide accurate details</li>
                <li>Customers acknowledge they understand product descriptions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Use of Service</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to use our service only for lawful purposes. You must not:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Attempt to resell our products as genuine branded items</li>
                <li>Misrepresent the nature of our products to third parties</li>
                <li>Use our products for any illegal purposes</li>
                <li>Violate any applicable local, state, national, or international law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed">
                All trademarks, logos, and brand names mentioned on this website belong to their respective owners. We acknowledge that all brand names and trademarks are the property of their respective owners and are used solely for descriptive purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Pricing and Payment</h2>
              <p className="text-gray-700 leading-relaxed">
                All prices are listed in USD and are subject to change without notice. We accept various payment methods as indicated during checkout. Payment must be received before order processing begins.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Shipping and Delivery</h2>
              <p className="text-gray-700 leading-relaxed">
                We offer two shipping options:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>FedEx Express ($10):</strong> 8-10 business days delivery</li>
                <li><strong>Standard Shipping (Free):</strong> 10-15 business days delivery</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Delivery times are estimates and may vary due to customs processing or other factors beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Privacy Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We are committed to protecting your privacy. All personal information collected is used solely for order processing and customer service. We do not sell or share your information with third parties except as necessary to fulfill your order.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed">
                To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">9. Modifications to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the website. Continued use of the service after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">10. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                For questions about these Terms of Service, please contact us via WhatsApp or email as provided on our website.
              </p>
            </section>

            <div className="mt-12 p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Last Updated:</strong> January 2025
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsOfService;