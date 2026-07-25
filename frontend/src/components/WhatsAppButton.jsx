import { useContext, useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { CartContext } from '../App';
import { fetchWhatsappSettings, buildWaLink } from '../lib/whatsapp';

const WhatsAppButton = () => {
  const { API } = useContext(CartContext);
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchWhatsappSettings(API).then((data) => {
      if (active) setSettings(data);
    });
    return () => {
      active = false;
    };
  }, [API]);

  // Close the expanded menu when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!settings || !settings.enabled) return null;

  const buttons = settings.buttons || [];
  if (buttons.length === 0) return null;

  // Single contact -> keep the simple, direct floating link.
  if (buttons.length === 1) {
    const b = buttons[0];
    return (
      <a
        href={buildWaLink(b.number, b.message)}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full p-4 shadow-xl transition-all duration-300 hover:scale-110 whatsapp-pulse"
        data-testid="whatsapp-button"
        aria-label={`Contact us on WhatsApp: ${b.label}`}
        title={b.label}
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    );
  }

  // Multiple contacts -> expandable stack of labeled support buttons.
  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {settings.title && (
            <span className="mb-1 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-md">
              {settings.title}
            </span>
          )}
          {buttons.map((b) => (
            <a
              key={b.id}
              href={buildWaLink(b.number, b.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-full bg-white py-2 pl-4 pr-2 shadow-lg transition-all duration-200 hover:-translate-x-1 hover:shadow-xl"
              data-testid={`whatsapp-button-${b.id}`}
            >
              <span className="text-sm font-medium text-gray-800 group-hover:text-[#128C7E]">{b.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-full p-4 text-white shadow-xl transition-all duration-300 hover:scale-110 ${
          open ? 'bg-[#128C7E]' : 'bg-[#25D366] hover:bg-[#1ebe5d] whatsapp-pulse'
        }`}
        data-testid="whatsapp-button"
        aria-expanded={open}
        aria-label="WhatsApp support"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default WhatsAppButton;
