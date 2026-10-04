import React, { useState, useEffect, useMemo } from 'react';
import styles from './SmsModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shipment } from '@/types/shipment';
import { sendSms, sendBulkSms } from '@/lib/shipments';
import { Send, CheckCircle2, Copy, Smartphone, Info } from 'lucide-react';

export interface SmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If single shipment:
  shipment?: Shipment | null;
  // If bulk shipments:
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
  const readyShipments = useMemo(
    () =>
      shipments.filter(
        (s) => String(s.status || '').trim().toUpperCase() === 'READY'
      ),
    [shipments]
  );
  const targetShipment = useMemo(
    () =>
      shipment && String(shipment.status || '').trim().toUpperCase() === 'READY'
        ? shipment
        : null,
    [shipment]
  );
  const isBulk = readyShipments.length > 0;
  const targetCount = isBulk ? readyShipments.length : (targetShipment ? 1 : 0);

  // Sender Number stored in localStorage
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
      const validNumbers = readyShipments.map((s) => s.mobileNumber).filter(Boolean);
      setRecipientNumber(`${validNumbers.length} recipients selected (${validNumbers.slice(0, 3).join(', ')}${validNumbers.length > 3 ? '...' : ''})`);
      setMessage(
        `Hello {name}!` +
        `\n\nYour shipment is ready for dispatch.` +
        `\nTracking ID: {awb}` +
        `\nCourier Partner: {courier}` +
        `\nCity: {city}` +
        `\n\nThank you.`
      );
    } else if (targetShipment) {
      setRecipientNumber(targetShipment.mobileNumber || '');
      const name = targetShipment.name || 'Customer';
      const awb = targetShipment.awbNumber || 'N/A';
      const courier = targetShipment.courierPartnerName || 'N/A';
      const location = [targetShipment.city, targetShipment.state].filter(Boolean).join(', ') || 'N/A';
      const pincode = targetShipment.pincode || 'N/A';

      setMessage(
        `Hello ${name}!` +
        `\n\nYour shipment is ready for dispatch.` +
        `\nTracking ID: ${awb}` +
        `\nCourier Partner: ${courier}` +
        `\nCity/State: ${location}` +
        `\nPincode: ${pincode}` +
        `\n\nThank you.`
      );
    }
  }, [isOpen, targetShipment?.id, isBulk, readyShipments.length]);

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

  const handleSend = async () => {
    if (!senderNumber.trim()) {
      alert('Please enter your Sender Number (Mobile / SIM / Sender ID).');
      return;
    }
    if (!message.trim()) {
      alert('SMS message text cannot be empty.');
      return;
    }

    setIsSending(true);
    setSentSuccessMsg(null);

    try {
      if (isBulk) {
        const ids = readyShipments.map((s) => s.id);
        const res = await sendBulkSms({
          shipmentIds: ids,
          fromNumber: senderNumber.trim(),
          customMessage: message,
        });

        const successText = `Successfully dispatched SMS to ${res.sentCount} of ${res.totalCount} recipients from ${senderNumber}!`;
        setSentSuccessMsg(successText);
        onSuccess?.(successText);
      } else if (targetShipment) {
        if (!recipientNumber.trim()) {
          alert('Recipient mobile number is required.');
          setIsSending(false);
          return;
        }

        const res = await sendSms({
          shipmentId: targetShipment.id,
          fromNumber: senderNumber.trim(),
          toNumber: recipientNumber.trim(),
          message,
        });

        const successText = `SMS dispatched successfully from ${senderNumber} to ${recipientNumber}!`;
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
      title={isBulk ? `Bulk SMS Dispatch (${targetCount} Shipments)` : 'Direct SMS Notification'}
      size="md"
      footer={
        <div className={styles.footerActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyMessage}
            leftIcon={<Copy size={14} />}
          >
            {copied ? 'Copied!' : 'Copy Text'}
          </Button>

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
        {sentSuccessMsg ? (
          <div className={styles.successBanner}>
            <CheckCircle2 size={18} />
            <span>{sentSuccessMsg}</span>
          </div>
        ) : (
          <div className={styles.banner}>
            <Info size={16} />
            <span>
              Direct SMS dispatch via configured sender number. Enter your sender phone or SIM number below.
            </span>
          </div>
        )}

        <div className={styles.row2}>
          <Input
            label="Send From (Sender Phone / SIM No)"
            value={senderNumber}
            onChange={(e) => handleSenderChange(e.target.value)}
            placeholder="e.g. +91 9876543210"
            
          />
          <Input
            label={isBulk ? 'Recipients' : 'Recipient Mobile'}
            value={recipientNumber}
            onChange={(e) => !isBulk && setRecipientNumber(e.target.value)}
            placeholder="e.g. 9998989906"
            disabled={isBulk}
            type="tel"
          />
        </div>

        <div className={styles.textareaGroup}>
          <label className={styles.label}>SMS Message Content</label>
          <textarea
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS message here..."
          />
          {isBulk && (
            <div className={styles.chipsContainer}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variables:</span>
              <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {name}')}>+ {'{name}'}</button>
              <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {awb}')}>+ {'{awb}'}</button>
              <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {courier}')}>+ {'{courier}'}</button>
              <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {city}')}>+ {'{city}'}</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}