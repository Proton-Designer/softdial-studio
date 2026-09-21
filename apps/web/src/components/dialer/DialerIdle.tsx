import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Phone, Delete, ChevronDown } from 'lucide-react';
import type { UserPhoneNumber } from '../Dialer';

interface DialerIdleProps {
  userNumbers: UserPhoneNumber[];
  selectedFromNumber: string | null;
  onSelectNumber: (phoneNumber: string) => void;
  onDial: (phoneNumber: string) => void;
  isDialing: boolean;
  error: string | null;
}

const keypadButtons = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export function DialerIdle({
  userNumbers,
  selectedFromNumber,
  onSelectNumber,
  onDial,
  isDialing,
  error,
}: DialerIdleProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode] = useState('+1');
  const [numberPickerOpen, setNumberPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setNumberPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyPress = (digit: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(phoneNumber + digit);
    }
  };

  const handleDelete = () => {
    setPhoneNumber(phoneNumber.slice(0, -1));
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const fullPhoneNumber = phoneNumber ? `${countryCode}${phoneNumber.replace(/\D/g, '')}` : '';

  const handleCall = () => {
    if (!selectedFromNumber || !fullPhoneNumber) return;
    onDial(fullPhoneNumber);
  };

  const canDial =
    userNumbers.length > 0 && selectedFromNumber && fullPhoneNumber.length >= 10 && !isDialing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[600px] max-w-xs mx-auto"
    >
      {userNumbers.length === 0 && (
        <div className="mb-4 p-3 bg-[#FFB300]/10 border border-[#FFB300]/20 rounded-lg text-center">
          <p className="text-sm text-[#FFB300]">
            Purchase a phone number in Settings to start calling.
          </p>
        </div>
      )}

      {/* Number selector dropdown */}
      {userNumbers.length > 0 && (
        <div className="mb-3 w-full" ref={pickerRef}>
          <label className="text-xs text-[#B0BEC5] mb-1.5 block">Call from</label>
          <div className="relative">
            <button
              onClick={() => setNumberPickerOpen(!numberPickerOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1A2332]/60 backdrop-blur-xl border border-white/10 rounded-lg hover:border-[#00D9FF]/30 transition-all"
            >
              <span className="text-white font-medium truncate">
                {selectedFromNumber || 'Select number'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#B0BEC5] transition-transform ${numberPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {numberPickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A2332] border border-white/10 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                {userNumbers.map((num) => (
                  <button
                    key={num.id}
                    onClick={() => {
                      onSelectNumber(num.phone_number);
                      setNumberPickerOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-white hover:bg-[#1E2A3A] transition-colors"
                  >
                    {num.phone_number}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Country Code (display only for now) */}
      <div className="mb-2">
        <span className="text-base font-bold text-white">{countryCode}</span>
      </div>

      {/* Phone Number Display */}
      <div className="w-full mb-3">
        <div className="bg-[#1A2332]/60 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-3 text-center min-h-[50px] flex items-center justify-center">
          {phoneNumber ? (
            <span className="text-xl font-semibold text-white tracking-wider">
              {formatPhoneNumber(phoneNumber)}
            </span>
          ) : (
            <span className="text-base text-[#B0BEC5]/50">Enter phone number</span>
          )}
        </div>
      </div>

      {/* Keypad */}
      <div className="w-full mb-3">
        <div className="grid grid-cols-3 gap-2">
          {keypadButtons.map((button) => (
            <motion.button
              key={button.digit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleKeyPress(button.digit)}
              className="bg-[#1A2332]/60 backdrop-blur-xl border border-white/10 rounded-lg p-3 hover:bg-[#1E2A3A] hover:border-[#00D9FF]/30 transition-all group"
            >
              <div className="text-xl font-semibold text-white mb-0.5">{button.digit}</div>
              {button.letters && (
                <div className="text-[9px] text-[#B0BEC5] font-medium tracking-wider">
                  {button.letters}
                </div>
              )}
            </motion.button>
          ))}
        </div>

        <div className="flex justify-end mt-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            disabled={!phoneNumber}
            className={`p-2 rounded-lg transition-all ${
              phoneNumber
                ? 'bg-[#1A2332]/60 hover:bg-[#FF3D00]/10 border border-white/10 hover:border-[#FF3D00]/30 text-white hover:text-[#FF3D00]'
                : 'bg-[#1A2332]/30 border border-white/5 text-[#B0BEC5]/30 cursor-not-allowed'
            }`}
          >
            <Delete className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Call Button */}
      <motion.button
        onClick={handleCall}
        disabled={!canDial}
        whileHover={canDial ? { scale: 1.05 } : {}}
        whileTap={canDial ? { scale: 0.95 } : {}}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
          canDial
            ? 'bg-gradient-to-br from-[#00E676] to-[#00D9FF] shadow-[0_6px_24px_rgba(0,230,118,0.4)] hover:shadow-[0_8px_32px_rgba(0,230,118,0.6)]'
            : 'bg-[#1A2332]/60 border border-white/10 cursor-not-allowed'
        }`}
      >
        <Phone className={`w-6 h-6 ${canDial ? 'text-white' : 'text-[#B0BEC5]/30'}`} />
      </motion.button>

      {error && <p className="mt-3 text-sm text-[#FF3D00] text-center">{error}</p>}

      {isDialing && <p className="mt-2 text-sm text-[#00D9FF]">Connecting...</p>}
    </motion.div>
  );
}
