import { useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { CartContext } from '../../App';
import { Plus, Trash2, Save, Settings, Link as LinkIcon, Bell, Mail, CreditCard, Eye, EyeOff, Key, MessageCircle, Truck, Pencil, X } from 'lucide-react';

const AdminSettings = () => {
  const { API, token } = useContext(CartContext);
  const [activeTab, setActiveTab] = useState('payment');
  const [loading, setLoading] = useState(false);

  // Payment Gateways State
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [corePayments, setCorePayments] = useState({
    stripe: true,
    plisio: true,
    manual: true,
    stripe_configured: false,
    plisio_configured: false,
  });
  const [newGateway, setNewGateway] = useState({
    gateway_type: 'manual',
    name: '',
    description: '',
    logo_url: '',
    enabled: true,
    instructions: ''
  });

  // Shipping / Delivery Methods State
  const emptyShippingMethod = () => ({ name: '', description: '', cost: 0, estimated_days: '', enabled: true, order: 0 });
  const [shippingMethods, setShippingMethods] = useState([]);
  const [newShippingMethod, setNewShippingMethod] = useState(emptyShippingMethod());
  const [editingShippingId, setEditingShippingId] = useState(null);
  const [editShippingData, setEditShippingData] = useState(emptyShippingMethod());

  // Social Links State
  const [socialLinks, setSocialLinks] = useState([]);
  const [newSocialLink, setNewSocialLink] = useState({
    platform: 'facebook',
    url: '',
    enabled: true
  });

  // External Links State
  const [externalLinks, setExternalLinks] = useState([]);
  const [newExternalLink, setNewExternalLink] = useState({
    title: '',
    url: '',
    enabled: true
  });

  // Floating Announcement State
  const [announcement, setAnnouncement] = useState({
    enabled: false,
    title: '',
    message: '',
    image_url: '',
    link_url: '',
    link_text: 'Learn More',
    button_color: '#d4af37',
    frequency: 'once_per_session'
  });

  // WhatsApp Support State (up to 3 buttons)
  const emptyWhatsappButton = (id) => ({ id, label: '', number: '', message: '', enabled: false });
  const [whatsapp, setWhatsapp] = useState({
    enabled: true,
    title: 'Chat with us on WhatsApp',
    buttons: [emptyWhatsappButton('1'), emptyWhatsappButton('2'), emptyWhatsappButton('3')]
  });

  // Bulk Email State
  const [bulkEmail, setBulkEmail] = useState({
    subject: '',
    message: '',
    recipient_filter: 'all'
  });
  const [bulkEmailHistory, setBulkEmailHistory] = useState([]);

  // API Keys State
  const [apiKeys, setApiKeys] = useState({
    resend_api_key: '',
    stripe_secret_key: '',
    stripe_publishable_key: '',
    plisio_api_key: '',
    from_email: '',
    from_name: 'Kayee01'
  });
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      if (activeTab === 'payment') {
        const [gw, core] = await Promise.all([
          axios.get(`${API}/admin/settings/payment-gateways`, { headers }),
          axios.get(`${API}/admin/settings/core-payment-methods`, { headers }),
        ]);
        setPaymentGateways(gw.data);
        setCorePayments((prev) => ({ ...prev, ...core.data }));
      } else if (activeTab === 'shipping') {
        const res = await axios.get(`${API}/admin/settings/shipping-methods`, { headers });
        setShippingMethods(res.data);
      } else if (activeTab === 'social') {
        const res = await axios.get(`${API}/admin/settings/social-links`, { headers });
        setSocialLinks(res.data);
      } else if (activeTab === 'external') {
        const res = await axios.get(`${API}/admin/settings/external-links`, { headers });
        setExternalLinks(res.data);
      } else if (activeTab === 'announcement') {
        const res = await axios.get(`${API}/admin/settings/floating-announcement`, { headers });
        if (res.data) setAnnouncement(res.data);
      } else if (activeTab === 'whatsapp') {
        const res = await axios.get(`${API}/admin/settings/whatsapp`, { headers });
        if (res.data) {
          // Always render exactly 3 button slots for a stable editor.
          const buttons = [...(res.data.buttons || [])];
          while (buttons.length < 3) {
            buttons.push(emptyWhatsappButton(String(buttons.length + 1)));
          }
          setWhatsapp({
            enabled: res.data.enabled !== false,
            title: res.data.title || 'Chat with us on WhatsApp',
            buttons: buttons.slice(0, 3)
          });
        }
      } else if (activeTab === 'bulk-email') {
        const res = await axios.get(`${API}/admin/settings/bulk-emails`, { headers });
        setBulkEmailHistory(res.data);
      } else if (activeTab === 'api-keys') {
        const res = await axios.get(`${API}/admin/api-settings`, { headers });
        setApiKeys(res.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // Payment Gateway Functions
  const addPaymentGateway = async () => {
    if (!newGateway.name) {
      toast.error('Please enter gateway name');
      return;
    }

    // For manual payments, instructions are required
    if (newGateway.gateway_type === 'manual' && !newGateway.instructions) {
      toast.error('Please enter payment instructions for manual payment');
      return;
    }
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/admin/settings/payment-gateways`, newGateway, { headers });
      console.log('Payment gateway created:', response.data);
      toast.success('Payment gateway added successfully!');
      setNewGateway({
        gateway_type: 'manual',
        name: '',
        description: '',
        logo_url: '',
        enabled: true,
        instructions: ''
      });
      await loadData();
    } catch (error) {
      console.error('Failed to add payment gateway:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to add payment gateway';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const deletePaymentGateway = async (gatewayId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/settings/payment-gateways/${gatewayId}`, { headers });
      toast.success('Payment gateway deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete payment gateway');
    }
  };

  const saveCorePayments = async (next) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(
        `${API}/admin/settings/core-payment-methods`,
        { stripe: next.stripe, plisio: next.plisio, manual: next.manual },
        { headers }
      );
      setCorePayments((prev) => ({ ...prev, ...res.data }));
      toast.success('Checkout payment methods updated');
    } catch (error) {
      toast.error('Failed to update payment methods');
    }
  };

  const togglePaymentGateway = async (gateway) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const updated = { ...gateway, enabled: !gateway.enabled };
      await axios.put(
        `${API}/admin/settings/payment-gateways/${gateway.gateway_id}`,
        updated,
        { headers }
      );
      toast.success(updated.enabled ? 'Gateway enabled on checkout' : 'Gateway hidden from checkout');
      loadData();
    } catch (error) {
      toast.error('Failed to update gateway');
    }
  };

  // Shipping / Delivery Method Functions
  const normalizeShipping = (data) => ({
    name: (data.name || '').trim(),
    description: (data.description || '').trim(),
    cost: parseFloat(data.cost) || 0,
    estimated_days: (data.estimated_days || '').trim(),
    enabled: data.enabled !== false,
    order: parseInt(data.order, 10) || 0,
  });

  const addShippingMethod = async () => {
    if (!newShippingMethod.name.trim()) {
      toast.error('Please enter a delivery method name');
      return;
    }
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/settings/shipping-methods`, normalizeShipping(newShippingMethod), { headers });
      toast.success('Delivery method added successfully!');
      setNewShippingMethod(emptyShippingMethod());
      await loadData();
    } catch (error) {
      console.error('Failed to add delivery method:', error);
      toast.error(error.response?.data?.detail || 'Failed to add delivery method');
    } finally {
      setLoading(false);
    }
  };

  const startEditShipping = (method) => {
    setEditingShippingId(method.id);
    setEditShippingData({
      name: method.name || '',
      description: method.description || '',
      cost: method.cost ?? 0,
      estimated_days: method.estimated_days || '',
      enabled: method.enabled !== false,
      order: method.order || 0,
    });
  };

  const cancelEditShipping = () => {
    setEditingShippingId(null);
    setEditShippingData(emptyShippingMethod());
  };

  const saveEditShipping = async (methodId) => {
    if (!editShippingData.name.trim()) {
      toast.error('Please enter a delivery method name');
      return;
    }
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/settings/shipping-methods/${methodId}`, normalizeShipping(editShippingData), { headers });
      toast.success('Delivery method updated');
      cancelEditShipping();
      await loadData();
    } catch (error) {
      console.error('Failed to update delivery method:', error);
      toast.error(error.response?.data?.detail || 'Failed to update delivery method');
    } finally {
      setLoading(false);
    }
  };

  const deleteShippingMethod = async (methodId) => {
    if (!window.confirm('Are you sure you want to delete this delivery method?')) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/settings/shipping-methods/${methodId}`, { headers });
      toast.success('Delivery method deleted');
      await loadData();
    } catch (error) {
      console.error('Failed to delete delivery method:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete delivery method');
    } finally {
      setLoading(false);
    }
  };

  // Social Link Functions
  const addSocialLink = async () => {
    if (!newSocialLink.url) {
      toast.error('Veuillez entrer une URL');
      return;
    }
    
    // Validate URL format
    if (!newSocialLink.url.startsWith('http://') && !newSocialLink.url.startsWith('https://')) {
      toast.error('L\'URL doit commencer par http:// ou https://');
      return;
    }
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/admin/settings/social-links`, newSocialLink, { headers });
      console.log('Social link created:', response.data);
      toast.success('Lien social ajouté avec succès !');
      setNewSocialLink({ platform: 'facebook', url: '', enabled: true });
      await loadData();
    } catch (error) {
      console.error('Failed to add social link:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Échec de l\'ajout du lien social';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const deleteSocialLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to delete this social link?')) {
      return;
    }
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/settings/social-links/${linkId}`, { headers });
      toast.success('Lien social supprimé avec succès');
      await loadData();
    } catch (error) {
      console.error('Failed to delete social link:', error);
      const errorMsg = error.response?.data?.detail || 'Échec de la suppression du lien social';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // External Link Functions
  const addExternalLink = async () => {
    if (!newExternalLink.title || !newExternalLink.url) {
      toast.error('Veuillez entrer le titre et l\'URL');
      return;
    }
    
    // Validate URL format
    if (!newExternalLink.url.startsWith('http://') && !newExternalLink.url.startsWith('https://')) {
      toast.error('L\'URL doit commencer par http:// ou https://');
      return;
    }
    
    if (externalLinks.length >= 3) {
      toast.error('Maximum 3 liens externes autorisés');
      return;
    }
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/admin/settings/external-links`, newExternalLink, { headers });
      console.log('External link created:', response.data);
      toast.success('Lien externe ajouté avec succès !');
      setNewExternalLink({ title: '', url: '', enabled: true });
      await loadData();
    } catch (error) {
      console.error('Failed to add external link:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Échec de l\'ajout du lien externe';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const deleteExternalLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to delete this external link?')) {
      return;
    }
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/settings/external-links/${linkId}`, { headers });
      toast.success('Lien externe supprimé avec succès');
      await loadData();
    } catch (error) {
      console.error('Failed to delete external link:', error);
      const errorMsg = error.response?.data?.detail || 'Échec de la suppression du lien externe';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Floating Announcement Functions
  const saveAnnouncement = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/settings/floating-announcement`, announcement, { headers });
      toast.success('Floating announcement updated');
    } catch (error) {
      toast.error('Failed to update announcement');
    }
  };

  // WhatsApp Support Functions
  const updateWhatsappButton = (index, field, value) => {
    setWhatsapp((prev) => {
      const buttons = prev.buttons.map((b, i) => (i === index ? { ...b, [field]: value } : b));
      return { ...prev, buttons };
    });
  };

  const saveWhatsapp = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      // Only persist buttons that have a phone number.
      const payload = {
        enabled: whatsapp.enabled,
        title: whatsapp.title,
        buttons: whatsapp.buttons
          .filter((b) => (b.number || '').trim())
          .map((b, i) => ({
            id: String(i + 1),
            label: b.label || `Support ${i + 1}`,
            number: b.number.trim(),
            message: b.message || '',
            enabled: b.enabled !== false
          }))
      };
      await axios.put(`${API}/admin/settings/whatsapp`, payload, { headers });
      toast.success('WhatsApp settings saved successfully');
      await loadData();
    } catch (error) {
      console.error('Failed to save WhatsApp settings:', error);
      toast.error('Failed to save WhatsApp settings');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Email Functions
  const sendBulkEmail = async () => {
    if (!bulkEmail.subject || !bulkEmail.message) {
      toast.error('Please enter subject and message');
      return;
    }
    
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API}/admin/settings/bulk-email`, bulkEmail, { headers });
      toast.success(res.data.message);
      setBulkEmail({ subject: '', message: '', recipient_filter: 'all' });
      loadData();
    } catch (error) {
      toast.error('Failed to send bulk email');
    } finally {
      setLoading(false);
    }
  };

  // API Keys Functions
  const saveApiKeys = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/api-settings`, apiKeys, { headers });
      toast.success('API keys updated successfully');
    } catch (error) {
      console.error('Failed to save API keys:', error);
      toast.error('Failed to save API keys');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowKey = (keyName) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const tabs = [
    { id: 'payment', label: 'Payment Gateways', icon: CreditCard },
    { id: 'shipping', label: 'Delivery Methods', icon: Truck },
    { id: 'social', label: 'Social Links', icon: LinkIcon },
    { id: 'external', label: 'External Links', icon: LinkIcon },
    { id: 'announcement', label: 'Floating Announcement', icon: Bell },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'bulk-email', label: 'Bulk Email', icon: Mail },
    { id: 'api-keys', label: 'API Keys', icon: Settings },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center">
            <Settings className="h-6 w-6 md:h-8 md:w-8 mr-2 md:mr-3" />
            Admin Settings
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Manage payment gateways, social links, and announcements</p>
        </div>
      </div>

      {/* Tabs - Mobile Responsive */}
      <div className="flex gap-1 md:gap-2 border-b pb-2 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-2 md:px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap text-xs md:text-base ${
              activeTab === tab.id
                ? 'bg-[#d4af37] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Payment Gateways Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checkout payment methods</CardTitle>
              <p className="text-sm text-gray-600 font-normal">
                Only methods that are ON below (and configured with API keys for Stripe/Plisio) appear on checkout.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: 'stripe',
                  label: 'Stripe (card)',
                  hint: corePayments.stripe_configured
                    ? 'API keys configured'
                    : 'Add Stripe keys in the API Keys tab — otherwise it stays hidden',
                },
                {
                  key: 'plisio',
                  label: 'Plisio (crypto)',
                  hint: corePayments.plisio_configured
                    ? 'API key configured'
                    : 'Add Plisio key in the API Keys tab — otherwise it stays hidden',
                },
                {
                  key: 'manual',
                  label: 'Bank / Payoneer (manual)',
                  hint: 'No API key required',
                },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">{row.label}</p>
                    <p className="text-xs text-gray-500">{row.hint}</p>
                  </div>
                  <Switch
                    checked={!!corePayments[row.key]}
                    onCheckedChange={(checked) => {
                      const next = { ...corePayments, [row.key]: checked };
                      setCorePayments(next);
                      saveCorePayments(next);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Payment Gateway</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Gateway Type</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={newGateway.gateway_type}
                    onChange={(e) => setNewGateway({ ...newGateway, gateway_type: e.target.value })}
                  >
                    <option value="manual">Manual Payment</option>
                    <option value="stripe">Stripe</option>
                    <option value="plisio">Plisio (Crypto)</option>
                  </select>
                </div>
                <div>
                  <Label>Gateway Name *</Label>
                  <Input
                    value={newGateway.name}
                    onChange={(e) => setNewGateway({ ...newGateway, name: e.target.value })}
                    placeholder="e.g., PayPal, Bank Transfer"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={newGateway.description}
                  onChange={(e) => setNewGateway({ ...newGateway, description: e.target.value })}
                  placeholder="Brief description of this payment method"
                />
              </div>
              <div>
                <Label>Logo URL (optional)</Label>
                <Input
                  value={newGateway.logo_url}
                  onChange={(e) => setNewGateway({ ...newGateway, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              {newGateway.gateway_type === 'manual' && (
                <div>
                  <Label>Payment Instructions *</Label>
                  <Textarea
                    value={newGateway.instructions}
                    onChange={(e) => setNewGateway({ ...newGateway, instructions: e.target.value })}
                    placeholder="Provide payment instructions (e.g., bank account details, PayPal email, etc.)"
                    rows={4}
                  />
                </div>
              )}
              <Button 
                onClick={addPaymentGateway} 
                className="bg-[#d4af37] hover:bg-[#b8941f]"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Adding...' : 'Add Gateway'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Payment Gateways ({paymentGateways.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentGateways.map((gateway) => (
                  <div key={gateway.gateway_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border rounded gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm md:text-base">{gateway.name}</p>
                      <p className="text-xs md:text-sm text-gray-600">{gateway.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Type: {gateway.gateway_type}
                        {gateway.enabled === false && (
                          <span className="ml-2 text-amber-700 font-medium">· Hidden on checkout</span>
                        )}
                      </p>
                      {gateway.instructions && (
                        <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap break-words">{gateway.instructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Show</span>
                        <Switch
                          checked={gateway.enabled !== false}
                          onCheckedChange={() => togglePaymentGateway(gateway)}
                        />
                      </div>
                      <Button
                        onClick={() => deletePaymentGateway(gateway.gateway_id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {paymentGateways.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No payment gateways configured yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delivery Methods Tab */}
      {activeTab === 'shipping' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-5 w-5 mr-2 text-[#d4af37]" />
                Add Delivery Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newShippingMethod.name}
                    onChange={(e) => setNewShippingMethod({ ...newShippingMethod, name: e.target.value })}
                    placeholder="e.g., Free Delivery, FedEx Express"
                  />
                </div>
                <div>
                  <Label>Cost (USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newShippingMethod.cost}
                    onChange={(e) => setNewShippingMethod({ ...newShippingMethod, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newShippingMethod.description}
                    onChange={(e) => setNewShippingMethod({ ...newShippingMethod, description: e.target.value })}
                    placeholder="e.g., Delivery in 7-14 business days"
                  />
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={newShippingMethod.order}
                    onChange={(e) => setNewShippingMethod({ ...newShippingMethod, order: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newShippingMethod.enabled}
                  onCheckedChange={(checked) => setNewShippingMethod({ ...newShippingMethod, enabled: checked })}
                />
                <Label>Enabled (visible at checkout)</Label>
              </div>
              <Button onClick={addShippingMethod} className="bg-[#d4af37] hover:bg-[#b8941f]" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Adding...' : 'Add Delivery Method'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Delivery Methods ({shippingMethods.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shippingMethods.map((method) => (
                  <div key={method.id} className="p-3 md:p-4 border rounded">
                    {editingShippingId === method.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Name *</Label>
                            <Input
                              value={editShippingData.name}
                              onChange={(e) => setEditShippingData({ ...editShippingData, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Cost (USD)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editShippingData.cost}
                              onChange={(e) => setEditShippingData({ ...editShippingData, cost: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Description</Label>
                            <Input
                              value={editShippingData.description}
                              onChange={(e) => setEditShippingData({ ...editShippingData, description: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Display Order</Label>
                            <Input
                              type="number"
                              value={editShippingData.order}
                              onChange={(e) => setEditShippingData({ ...editShippingData, order: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editShippingData.enabled}
                            onCheckedChange={(checked) => setEditShippingData({ ...editShippingData, enabled: checked })}
                          />
                          <Label>Enabled</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => saveEditShipping(method.id)} className="bg-[#d4af37] hover:bg-[#b8941f]" size="sm" disabled={loading}>
                            <Save className="h-4 w-4 mr-1" /> Save
                          </Button>
                          <Button onClick={cancelEditShipping} variant="outline" size="sm">
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm md:text-base break-words">
                            {method.name}
                            {method.enabled === false && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">Disabled</span>
                            )}
                          </p>
                          {method.description && (
                            <p className="text-xs md:text-sm text-gray-600 break-words">{method.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Cost: {Number(method.cost) > 0 ? `$${Number(method.cost).toFixed(2)}` : 'FREE'}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button onClick={() => startEditShipping(method)} variant="outline" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => deleteShippingMethod(method.id)} variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {shippingMethods.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No delivery methods configured yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Social Links Tab */}
      {activeTab === 'social' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Social Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Platform</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={newSocialLink.platform}
                    onChange={(e) => setNewSocialLink({ ...newSocialLink, platform: e.target.value })}
                  >
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="twitter">Twitter</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={newSocialLink.url}
                    onChange={(e) => setNewSocialLink({ ...newSocialLink, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <Button 
                onClick={addSocialLink} 
                className="bg-[#d4af37] hover:bg-[#b8941f]"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Adding...' : 'Add Social Link'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Links ({socialLinks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {socialLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <p className="font-semibold capitalize">{link.platform}</p>
                      <p className="text-sm text-gray-600">{link.url}</p>
                    </div>
                    <Button
                      onClick={() => deleteSocialLink(link.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {socialLinks.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No social links added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* External Links Tab */}
      {activeTab === 'external' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add External Link (Max 3)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={newExternalLink.title}
                    onChange={(e) => setNewExternalLink({ ...newExternalLink, title: e.target.value })}
                    placeholder="e.g., Guide d'achat"
                  />
                </div>
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={newExternalLink.url}
                    onChange={(e) => setNewExternalLink({ ...newExternalLink, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <Button 
                onClick={addExternalLink} 
                className="bg-[#d4af37] hover:bg-[#b8941f]"
                disabled={externalLinks.length >= 3 || loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Adding...' : externalLinks.length >= 3 ? 'Maximum reached (3)' : 'Add External Link'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>External Links ({externalLinks.length}/3)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {externalLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <p className="font-semibold">{link.title}</p>
                      <p className="text-sm text-gray-600">{link.url}</p>
                    </div>
                    <Button
                      onClick={() => deleteExternalLink(link.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {externalLinks.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No external links added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Announcement Tab */}
      {activeTab === 'announcement' && (
        <Card>
          <CardHeader>
            <CardTitle>Floating Announcement (Shein-Style Popup)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={announcement.enabled}
                onCheckedChange={(checked) => setAnnouncement({ ...announcement, enabled: checked })}
              />
              <Label>Enable Floating Announcement</Label>
            </div>

            <div>
              <Label>Title (optional)</Label>
              <Input
                value={announcement.title || ''}
                onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                placeholder="Special Offer!"
              />
            </div>

            <div>
              <Label>Message *</Label>
              <Textarea
                value={announcement.message}
                onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                placeholder="Get 20% OFF on all products this week!"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Image URL (optional)</Label>
                <Input
                  value={announcement.image_url || ''}
                  onChange={(e) => setAnnouncement({ ...announcement, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Link URL (optional)</Label>
                <Input
                  value={announcement.link_url || ''}
                  onChange={(e) => setAnnouncement({ ...announcement, link_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Link Button Text</Label>
                <Input
                  value={announcement.link_text}
                  onChange={(e) => setAnnouncement({ ...announcement, link_text: e.target.value })}
                  placeholder="Learn More"
                />
              </div>
              <div>
                <Label>Display Frequency</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={announcement.frequency}
                  onChange={(e) => setAnnouncement({ ...announcement, frequency: e.target.value })}
                >
                  <option value="once_per_session">Once per session</option>
                  <option value="every_visit">Every visit</option>
                  <option value="daily">Once per day</option>
                </select>
              </div>
            </div>

            <Button onClick={saveAnnouncement} className="bg-[#d4af37] hover:bg-[#b8941f]">
              <Save className="h-4 w-4 mr-2" />
              Save Announcement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Support Tab */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <Card className="border-green-200 bg-green-50/40">
            <CardContent className="pt-6 text-sm text-gray-700 space-y-2">
              <p className="font-semibold text-gray-900">How admins receive chat messages</p>
              <p>
                The green chat button opens <strong>WhatsApp</strong> on the customer’s phone and sends
                a message to the numbers you set below. Messages arrive in the WhatsApp app / WhatsApp Business
                on those phones — they are <strong>not stored inside this website’s database</strong>.
              </p>
              <p>
                To reply: open WhatsApp on the phone for Customer Support / Sales / Wholesale and answer there.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-green-600" />
                WhatsApp Support Buttons (Max 3)
              </CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                Configure up to 3 WhatsApp assistance buttons. Enabled buttons appear in the
                floating support widget, the footer and the order confirmation page.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={whatsapp.enabled}
                  onCheckedChange={(checked) => setWhatsapp({ ...whatsapp, enabled: checked })}
                />
                <Label>Enable WhatsApp support on the storefront</Label>
              </div>

              <div>
                <Label>Widget Title</Label>
                <Input
                  value={whatsapp.title}
                  onChange={(e) => setWhatsapp({ ...whatsapp, title: e.target.value })}
                  placeholder="Chat with us on WhatsApp"
                />
              </div>

              {whatsapp.buttons.map((button, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                      Button {index + 1}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={button.enabled}
                        onCheckedChange={(checked) => updateWhatsappButton(index, 'enabled', checked)}
                      />
                      <Label className="text-sm">Enabled</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Label</Label>
                      <Input
                        value={button.label}
                        onChange={(e) => updateWhatsappButton(index, 'label', e.target.value)}
                        placeholder="e.g., Customer Support"
                      />
                    </div>
                    <div>
                      <Label>WhatsApp Number (with country code)</Label>
                      <Input
                        value={button.number}
                        onChange={(e) => updateWhatsappButton(index, 'number', e.target.value)}
                        placeholder="+12393293813"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Pre-filled Message (optional)</Label>
                    <Textarea
                      value={button.message}
                      onChange={(e) => updateWhatsappButton(index, 'message', e.target.value)}
                      placeholder="Hello Kayee01, I need assistance."
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              <Button
                onClick={saveWhatsapp}
                className="bg-[#d4af37] hover:bg-[#b8941f]"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save WhatsApp Settings'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Email Tab */}
      {activeTab === 'bulk-email' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk Email / Newsletter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Recipient Filter</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={bulkEmail.recipient_filter}
                  onChange={(e) => setBulkEmail({ ...bulkEmail, recipient_filter: e.target.value })}
                >
                  <option value="all">All Customers</option>
                  <option value="with_orders">Customers with Orders</option>
                </select>
              </div>

              <div>
                <Label>Subject *</Label>
                <Input
                  value={bulkEmail.subject}
                  onChange={(e) => setBulkEmail({ ...bulkEmail, subject: e.target.value })}
                  placeholder="e.g., Special Coupon Code Inside!"
                />
              </div>

              <div>
                <Label>Message *</Label>
                <Textarea
                  value={bulkEmail.message}
                  onChange={(e) => setBulkEmail({ ...bulkEmail, message: e.target.value })}
                  placeholder="Use code WELCOME10 for 10% OFF your next order! Valid until [date]"
                  rows={6}
                />
              </div>

              <Button
                onClick={sendBulkEmail}
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                <Mail className="h-4 w-4 mr-2" />
                {loading ? 'Sending...' : 'Send Bulk Email'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bulkEmailHistory.map((email) => (
                  <div key={email.id} className="p-4 border rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{email.subject}</p>
                        <p className="text-sm text-gray-600 mt-1">{email.message.substring(0, 100)}...</p>
                      </div>
                      <p className="text-xs text-gray-500">Sent to {email.sent_to} customers</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(email.sent_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {bulkEmailHistory.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No emails sent yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                API Keys & Integration Settings
              </CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                Configure your payment gateways and email service API keys. These keys are stored securely.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Resend Email Service */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-purple-600" />
                  Resend Email Service (Recommended)
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Resend API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKeys.resend_api_key ? 'text' : 'password'}
                        value={apiKeys.resend_api_key}
                        onChange={(e) => setApiKeys({ ...apiKeys, resend_api_key: e.target.value })}
                        placeholder="re_..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleShowKey('resend_api_key')}
                      >
                        {showKeys.resend_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">resend.com/api-keys</a>. Free tier: 3,000 emails/month.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Stripe Settings */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                  Stripe Payment Gateway
                </h3>
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                  Use keys from{' '}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Stripe Dashboard → API keys
                  </a>
                  . Secret must start with <code className="font-mono">sk_live_</code> or{' '}
                  <code className="font-mono">sk_test_</code>, publishable with{' '}
                  <code className="font-mono">pk_live_</code> / <code className="font-mono">pk_test_</code>.
                  Do not paste account IDs or other codes (e.g. values starting with <code className="font-mono">mk_</code>).
                </p>
                <div className="space-y-4">
                  <div>
                    <Label>Stripe Secret Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKeys.stripe_secret_key ? 'text' : 'password'}
                        value={apiKeys.stripe_secret_key}
                        onChange={(e) => setApiKeys({ ...apiKeys, stripe_secret_key: e.target.value })}
                        placeholder="sk_live_… or sk_test_…"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleShowKey('stripe_secret_key')}
                      >
                        {showKeys.stripe_secret_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Stripe Publishable Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKeys.stripe_publishable_key ? 'text' : 'password'}
                        value={apiKeys.stripe_publishable_key}
                        onChange={(e) => setApiKeys({ ...apiKeys, stripe_publishable_key: e.target.value })}
                        placeholder="pk_live_… or pk_test_…"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleShowKey('stripe_publishable_key')}
                      >
                        {showKeys.stripe_publishable_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const headers = { Authorization: `Bearer ${token}` };
                        if (
                          (apiKeys.stripe_secret_key || '').trim() ||
                          (apiKeys.stripe_publishable_key || '').trim()
                        ) {
                          await axios.post(`${API}/admin/api-settings`, apiKeys, { headers });
                        }
                        const res = await axios.post(
                          `${API}/admin/api-settings/test-stripe`,
                          {},
                          { headers }
                        );
                        toast.success(res.data?.message || 'Stripe keys work');
                      } catch (error) {
                        toast.error(
                          error?.response?.data?.detail || 'Stripe key test failed'
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Test Stripe keys
                  </Button>
                </div>
              </div>

              {/* Plisio Settings */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-purple-600" />
                  Plisio Crypto Payment Gateway
                </h3>
                <div>
                  <Label>Plisio API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.plisio_api_key ? 'text' : 'password'}
                      value={apiKeys.plisio_api_key}
                      onChange={(e) => setApiKeys({ ...apiKeys, plisio_api_key: e.target.value })}
                      placeholder="Enter Plisio API key"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleShowKey('plisio_api_key')}
                    >
                      {showKeys.plisio_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    After saving, click Test to confirm Plisio accepts the key. Checkout will redirect customers to the crypto invoice.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const headers = { Authorization: `Bearer ${token}` };
                        // Persist first if the field has a value typed in
                        if ((apiKeys.plisio_api_key || '').trim()) {
                          await axios.post(`${API}/admin/api-settings`, apiKeys, { headers });
                        }
                        const res = await axios.post(`${API}/admin/api-settings/test-plisio`, {}, { headers });
                        toast.success(res.data?.message || 'Plisio key works');
                      } catch (error) {
                        toast.error(
                          error?.response?.data?.detail || 'Plisio key test failed'
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Test Plisio key
                  </Button>
                </div>
              </div>

              {/* Email Sender Info */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-green-600" />
                  Email Sender Configuration
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>From Email</Label>
                      <Input
                        value={apiKeys.from_email}
                        onChange={(e) => setApiKeys({ ...apiKeys, from_email: e.target.value })}
                        placeholder="noreply@kayee01.com"
                      />
                    </div>
                    <div>
                      <Label>From Name</Label>
                      <Input
                        value={apiKeys.from_name}
                        onChange={(e) => setApiKeys({ ...apiKeys, from_name: e.target.value })}
                        placeholder="Kayee01"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={saveApiKeys} 
                  className="bg-[#d4af37] hover:bg-[#b8941f]"
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save API Settings'}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Note: API keys are encrypted and stored securely. Changes take effect immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
