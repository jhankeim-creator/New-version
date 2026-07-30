import React, { useState } from 'react';
import { useSeo } from '../lib/seo';
import Footer from '../components/Footer';

const FAQPage = () => {
  const [openIndex, setOpenIndex] = useState(null);

  useSeo({
    title: 'FAQ — Shipping, Returns & Product Help',
    description:
      'Answers to common questions about Kayee01 jewelry and watches: choosing sizes and colors, ordering, shipping, returns, refunds and order tracking.',
    keywords: ['FAQ', 'jewelry help', 'ring size', 'necklace', 'shipping', 'returns', 'order tracking'],
  });

  const faqs = [
    {
      question: "How do I choose the color and size of an item?",
      answer: (
        <div className="space-y-3">
          <p>
            When a product is available in several options, you will see selectable
            <strong> Color</strong> and <strong>Size</strong> buttons on the product page,
            right above the quantity selector. Simply tap the option you want before
            pressing <strong>Add to Cart</strong> — your choice is shown on the cart and at checkout.
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Available options are listed in each product description.</li>
            <li>You must pick every option (e.g. color and size) before adding to cart.</li>
            <li>The same item in a different color or size is kept as a separate cart line.</li>
          </ul>
        </div>
      )
    },
    {
      question: "What jewelry categories do you carry?",
      answer: (
        <div className="space-y-3">
          <p>Our jewelry is organized so you can shop by type and then by brand:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Necklaces</strong>, <strong>Rings</strong>, <strong>Bracelets</strong>, <strong>Earrings</strong> and <strong>Brooches</strong></li>
            <li>Within each type you can browse by designer brand</li>
            <li>Use the <strong>Categories</strong> menu in the top navigation to explore everything</li>
          </ul>
        </div>
      )
    },
    {
      question: "How do I place an order?",
      answer: (
        <p>
          Add your items to the cart (choosing color/size where applicable), open the cart,
          and press <strong>Proceed to Checkout</strong>. Enter your shipping details, pick a
          delivery method and a payment option, then confirm. You will receive an order
          confirmation with your order number.
        </p>
      )
    },
    {
      question: "Do you offer international shipping?",
      answer: (
        <p>Yes, we ship worldwide. Shipping times vary by destination (typically 7-21 business days), and tracking is provided for every order.</p>
      )
    },
    {
      question: "What is your return & refund policy?",
      answer: (
        <p>
          We offer a 30-day return policy. Items must be unworn and in their original
          condition and packaging. See our <a href="/refund-policy" className="text-[#d4af37] underline">Refund &amp; Return Policy</a> for
          full details on eligibility, timelines and refund methods.
        </p>
      )
    },
    {
      question: "Can I exchange for a different color or size?",
      answer: (
        <p>
          Yes. If you need a different color or size, contact us within 30 days of delivery.
          Exchanges are subject to availability, and we cover shipping costs when the exchange
          is due to a defect or an error on our part.
        </p>
      )
    },
    {
      question: "How can I track my order?",
      answer: (
        <p>You'll receive a tracking number by email once your order ships. You can also use the <a href="/track-order" className="text-[#d4af37] underline">Track Order</a> page or check "My Orders" in your account.</p>
      )
    },
    {
      question: "Which payment methods do you accept?",
      answer: (
        <p>We accept major credit/debit cards, cryptocurrency and additional manual methods shown at checkout. All payments are processed securely.</p>
      )
    },
    {
      question: "Do you offer a warranty?",
      answer: (
        <p>Yes — a 1-year warranty covering manufacturing defects. Contact our support team via WhatsApp or email for any issues.</p>
      )
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">Frequently Asked Questions</h1>
        
        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md mb-4">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition"
              >
                <h3 className="text-lg font-semibold text-gray-800">{faq.question}</h3>
                <span className="text-2xl text-purple-600">
                  {openIndex === index ? '−' : '+'}
                </span>
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-700">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FAQPage;
