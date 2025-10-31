import React, { useState } from 'react';

const FAQPage = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "How to choose quality watches and jewelry?",
      answer: (
        <div className="space-y-4">
          <p>When shopping for quality fashion watches and jewelry, consider these important factors:</p>
          
          <div>
            <h4 className="font-semibold">Customer Reviews and Reputation</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Check customer reviews and ratings</li>
              <li>Look for testimonials from verified buyers</li>
              <li>Research the company's reputation online</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Quality Standards</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Look for detailed product descriptions</li>
              <li>Check material specifications</li>
              <li>Review product images carefully</li>
              <li>Ask about quality control processes</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      question: "What quality grades do you offer?",
      answer: (
        <div className="space-y-4">
          <p>Our products come in different quality grades:</p>
          
          <div>
            <h4 className="font-semibold text-purple-600">Standard Grade</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Reliable quartz movements</li>
              <li>Durable stainless steel</li>
              <li>Scratch-resistant mineral crystal</li>
              <li>Water resistance</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-purple-600">Premium Grade</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Automatic mechanical movements</li>
              <li>Sapphire crystal</li>
              <li>316L stainless steel</li>
              <li>Enhanced water resistance</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      question: "Do you offer international shipping?",
      answer: (
        <p>Yes, we ship worldwide! Shipping times vary by destination (typically 7-21 business days). Tracking provided for all orders.</p>
      )
    },
    {
      question: "What is your return policy?",
      answer: (
        <p>We offer a 30-day return policy. Contact us within 30 days for returns or exchanges. Items must be unworn and in original condition.</p>
      )
    },
    {
      question: "How can I track my order?",
      answer: (
        <p>You'll receive a tracking number via email once shipped. Check "My Orders" in your account for status updates.</p>
      )
    },
    {
      question: "Are your products water-resistant?",
      answer: (
        <p>Many watches feature water resistance. Check individual product descriptions for specific ratings (3ATM, 5ATM, 10ATM).</p>
      )
    },
    {
      question: "Do you offer warranties?",
      answer: (
        <p>Yes! 1-year warranty covering manufacturing defects. Contact support for any issues.</p>
      )
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
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
    </div>
  );
};

export default FAQPage;
