import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminAPISettings = () => {
  const [settings, setSettings] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: '',
    plisio_api_key: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: 'Kayee01'
  });
  
  const [showKeys, setShowKeys] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/api-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleChange = (e) => {
    setSettings({
      ...settings,
      [e.target.name]: e.target.value
    });
  };

  const toggleShowKey = (key) => {
    setShowKeys({
      ...showKeys,
      [key]: !showKeys[key]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/api-settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'API settings updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (name, label, type = 'text', placeholder = '') => {
    const isPassword = type === 'password' || name.includes('key') || name.includes('password');
    const inputType = isPassword && !showKeys[name] ? 'password' : 'text';

    return (
      <div key={name} className="mb-4">
        <label className="block text-gray-700 font-semibold mb-2">
          {label}
        </label>
        <div className="relative">
          <input
            type={inputType}
            name={name}
            value={settings[name]}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => toggleShowKey(name)}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
            >
              {showKeys[name] ? '🙈' : '👁️'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">API Settings</h1>

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Stripe Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-purple-600">Stripe Payment Settings</h2>
          {renderInput('stripe_secret_key', 'Stripe Secret Key', 'password', 'sk_live_...')}
          {renderInput('stripe_publishable_key', 'Stripe Publishable Key', 'text', 'pk_live_...')}
        </div>

        {/* Plisio Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-purple-600">Plisio Crypto Payment Settings</h2>
          {renderInput('plisio_api_key', 'Plisio API Key', 'password')}
        </div>

        {/* SMTP Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-purple-600">Email (SMTP) Settings</h2>
          {renderInput('smtp_host', 'SMTP Host', 'text', 'smtp.gmail.com')}
          {renderInput('smtp_port', 'SMTP Port', 'number', '587')}
          {renderInput('smtp_user', 'SMTP Username/Email', 'email')}
          {renderInput('smtp_password', 'SMTP Password', 'password')}
          {renderInput('from_email', 'From Email', 'email')}
          {renderInput('from_name', 'From Name', 'text', 'Kayee01')}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 transition"
        >
          {loading ? 'Saving...' : 'Save API Settings'}
        </button>
      </form>
    </div>
  );
};

export default AdminAPISettings;
