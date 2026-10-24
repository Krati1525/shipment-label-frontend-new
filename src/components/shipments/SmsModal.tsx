'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './SmsModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shipment } from '@/types/shipment';
import { sendSms, sendBulkSms, formatWhatsAppPhone, getCourierTrackingInfo } from '@/lib/shipments';
import { Send, CheckCircle2, Copy, Smartphone, MessageCircle, Info, ExternalLink } from 'lucide-react';

export interface SmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment?: Shipment | null;
  shipments?: Shipment[];
  onSuccess?: (msg: string) => void;
}

export function SmsModal({
  isOpen,
  onClose,
  shipment,
  shipments = [],
  onSuccess,
}: SmsModalProps) {
  const targetShipment = shipment || null;
  const isBulk = shipments.length > 0;
  const targetCount = isBulk ? shipments.length : targetShipment ? 1 : 0;

  const [senderNumber, setSenderNumber] = useState<string>('');
  const [recipientNumber, setRecipientNumber] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccessMsg, setSentSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize sender number from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSender = localStorage.getItem('shipment_sms_sender_number');
      setSenderNumber(savedSender || '+91 9876543210');
    }
  }, []);

  // Initialize recipient and message template
  useEffect(() => {
    if (!isOpen) return;

    setSentSuccessMsg(null);
    if (isBulk) {
      const validNumbers = shipments.map((s) => s.mobileNumber).filter(Boolean);
      setRecipientNumber(
        `${validNumbers.length} recipients selected (${validNumbers.slice(0, 3).join(', ')}${
          validNumbers.length > 3 ? '...' : ''
        })`
      );
      setMessage(
        'Namaste {name}! 🙏\n\n' +
        'Your order from Draupadi Fashion is ready for dispatch! 📦\n' +
        'Tracking ID: {tracking_id}\n' +
        'Courier: {courier}\n' +
        'Destination: {city}\n\n' +
        'Thank you!'
      );
    } else if (targetShipment) {
      setRecipientNumber(targetShipment.mobileNumber || '');
      const name = targetShipment.name || 'Customer';
      const tracking = targetShipment.trackingId || targetShipment.awbNumber || 'Pending / N/A';
      const courierInfo = getCourierTrackingInfo(targetShipment.courierPartnerName, tracking);
      const location = [targetShipment.city, targetShipment.state].filter(Boolean).join(', ') || 'Your address';
      const trackLink = courierInfo.trackingUrl ? `\nTrack Online: ${courierInfo.trackingUrl}` : '';

      if (targetShipment.status === 'SHIPPED') {
        setMessage(
          `Namaste ${name}! 🙏\n\n` +
          `Your parcel from Draupadi Fashion has been dispatched! 🚚\n\n` +
          `🔖 Tracking ID: ${tracking}\n` +
          `🚚 Courier: ${courierInfo.name}\n` +
          `📍 Destination: ${location}` +
          `${trackLink}\n\n` +
          `Thank you for trusting Draupadi Fashion, Biaora!`
        );
      } else {
        setMessage(
          `Namaste ${name}! 🙏\n\n` +
          `Your parcel from Draupadi Fashion is ready for dispatch! 📦\n\n` +
          `🔖 Tracking ID: ${tracking}\n` +
          `🚚 Courier: ${courierInfo.name}\n` +
          `📍 Destination: ${location}` +
          `${trackLink}\n\n` +
          `Thank you for shopping with Draupadi Fashion, Biaora!`
        );
      }
    }
  }, [isOpen, targetShipment?.id, isBulk, shipments.length]);

  const handleSenderChange = (val: string) => {
    setSenderNumber(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shipment_sms_sender_number', val);
    }
  };

  const handleInsertTag = (tag: string) => {
    setMessage((prev) => prev + tag);
  };

  const handleCopyMessage = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Launch SMS on device (works on Mobile and Windows Phone Link / Messages)
  const handleOpenDeviceSms = () => {
    const rawDigits = recipientNumber.replace(/\D/g, '');
    if (!rawDigits) {
      alert('Please enter a valid recipient phone number.');
      return;
    }
    const cleanPhone = rawDigits.length === 10 ? `+91${rawDigits}` : rawDigits;
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsUri = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(message)}`;
    window.location.href = smsUri;
  };

  // Quick switch to send on WhatsApp
  const handleSendViaWhatsApp = () => {
    const clean = formatWhatsAppPhone(recipientNumber);
    if (!clean) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    const url = `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert('SMS message text cannot be empty.');
      return;
    }

    setIsSending(true);
    setSentSuccessMsg(null);

    try {
      if (isBulk) {
        const ids = shipments.map((s) => s.id);
        const res = await sendBulkSms({
          shipmentIds: ids,
          fromNumber: senderNumber.trim(),
          customMessage: message,
        });

        const successText = `Successfully prepared SMS for ${res.sentCount} of ${res.totalCount} recipients!`;
        setSentSuccessMsg(successText);
        onSuccess?.(successText);
      } else if (targetShipment) {
        const rawPhone = recipientNumber.replace(/\D/g, '');
        if (!rawPhone) {
          alert('Recipient mobile number is required.');
          setIsSending(false);
          return;
        }

        await sendSms({
          shipmentId: targetShipment.id,
          fromNumber: senderNumber.trim() || 'DraupadiFashion',
          toNumber: recipientNumber.trim(),
          message,
        });

        // Trigger device SMS application so user can send in 1 tap
        handleOpenDeviceSms();

        const successText = `SMS notification opened for ${recipientNumber}!`;
        setSentSuccessMsg(successText);
        onSuccess?.(successText);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send SMS.';
      alert(msg);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isBulk ? `Bulk SMS Dispatch (${targetCount} Shipments)` : 'Direct SMS Tracking Notification'}
      size="md"
      footer={
        <div className={styles.footerActions}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyMessage}
              leftIcon={<Copy size={14} />}
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
            {!isBulk && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendViaWhatsApp}
                leftIcon={<MessageCircle size={14} color="#16a34a" />}
                title="Send via WhatsApp Web/App"
              >
                Send via WhatsApp
              </Button>
            )}
          </div>

          <div className={styles.rightActions}>
            <Button variant="secondary" size="md" onClick={onClose} disabled={isSending}>
              Close
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              isLoading={isSending}
              disabled={isSending}
              leftIcon={<Send size={15} />}
            >
              {isSending ? 'Sending SMS...' : (isBulk ? `Send SMS to All (${targetCount})` : 'Send Direct SMS')}
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.infoBanner}>
          <Info size={16} />
          <span>
            Sends an SMS with the official <strong>Tracking ID / AWB Number</strong>. On mobile or Windows PC with Phone Link, clicking Send opens the device SMS app with the text pre-filled.
          </span>
        </div>

        {sentSuccessMsg && (
          <div className={styles.successAlert} role="alert">
            <CheckCircle2 size={16} />
            <span>{sentSuccessMsg}</span>
          </div>
        )}

        <div className={styles.fieldsGrid}>
          <Input
            label="Sender ID / Phone"
            value={senderNumber}
            onChange={(e) => handleSenderChange(e.target.value)}
            placeholder="e.g. DraupadiFashion or +919876543210"
          />

          <Input
            label={isBulk ? 'Recipients' : 'Recipient Mobile Number'}
            value={recipientNumber}
            onChange={(e) => setRecipientNumber(e.target.value)}
            placeholder="e.g. 9303003570"
            disabled={isBulk}
            type="tel"
          />
        </div>

        <div className={styles.textareaGroup}>
          <div className={styles.label}>
            <span>SMS Message (contains Tracking ID)</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {message.length} chars
            </span>
          </div>
          <textarea
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS message..."
            rows={6}
          />

          <div className={styles.chipsContainer}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variables:</span>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {name}')}>+ {'{name}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {tracking_id}')}>+ {'{tracking_id}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {courier}')}>+ {'{courier}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {city}')}>+ {'{city}'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}