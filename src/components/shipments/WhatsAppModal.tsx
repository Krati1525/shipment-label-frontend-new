'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './WhatsAppModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Shipment } from '@/types/shipment';
import { Send, CheckCircle2, MessageCircle, ExternalLink, Info, Copy } from 'lucide-react';

export interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment?: Shipment | null;
  shipments?: Shipment[];
  onSuccess?: (msg: string) => void;
}

export function WhatsAppModal({
  isOpen,
  onClose,
  shipment,
  shipments = [],
  onSuccess,
}: WhatsAppModalProps) {
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
  const targetList = useMemo(
    () => (isBulk ? readyShipments : targetShipment ? [targetShipment] : []),
    [isBulk, readyShipments, targetShipment]
  );

  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [nextIndex, setNextIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSentMap({});
    setNextIndex(0);

    if (isBulk) {
      setMessageTemplate(
        'Hello {name}!\n\n' +
        'Your shipment is ready for dispatch.\n' +
        'Tracking ID: {awb}\n' +
        'Courier Partner: {courier}\n' +
        'Destination: {city}\n\n' +
        'Thank you.'
      );
    } else if (targetShipment) {
      const name = targetShipment.name || 'Customer';
      const awb = targetShipment.awbNumber || 'N/A';
      const courier = targetShipment.courierPartnerName || 'N/A';
      const location = [targetShipment.city, targetShipment.state].filter(Boolean).join(', ') || 'N/A';

      setMessageTemplate(
        `Hello ${name}!\n\n` +
        `Your shipment is ready for dispatch.\n` +
        `Tracking ID: ${awb}\n` +
        `Courier Partner: ${courier}\n` +
        `Destination: ${location}\n\n` +
        `Thank you.`
      );
    }
  }, [isOpen, targetShipment?.id, isBulk, readyShipments.length]);

  const buildMessageForShipment = (s: Shipment): string => {
    return messageTemplate
      .replace(/\{name\}/gi, s.name || 'Customer')
      .replace(/\{awb\}/gi, s.awbNumber || 'N/A')
      .replace(/\{courier\}/gi, s.courierPartnerName || 'N/A')
      .replace(/\{city\}/gi, [s.city, s.state].filter(Boolean).join(', ') || '');
  };

  const getCleanPhone = (phone?: string | null): string | null => {
    if (!phone) return null;
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('91') && p.length === 12) {
      return p;
    }
    if (p.length === 10 && /^[6-9]/.test(p)) {
      return `91${p}`;
    }
    return p.length >= 10 ? p : null;
  };

  const handleSendSingle = (s: Shipment) => {
    const cleanPhone = getCleanPhone(s.mobileNumber);
    if (!cleanPhone) {
      alert(`Shipment ${s.name || s.id} has no valid mobile number.`);
      return;
    }

    const text = buildMessageForShipment(s);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    setSentMap((prev) => ({ ...prev, [s.id]: true }));
    onSuccess?.(`WhatsApp opened for ${s.name || cleanPhone}`);
  };

  const handleSendNext = () => {
    const pendingList = targetList.filter((s) => !sentMap[s.id] && getCleanPhone(s.mobileNumber));
    if (pendingList.length === 0) {
      alert('All selected recipients have been messaged!');
      return;
    }

    const nextShipment = pendingList[0];
    handleSendSingle(nextShipment);

    const newSentCount = Object.keys(sentMap).length + 1;
    if (newSentCount >= targetList.length) {
      onSuccess?.(`Completed WhatsApp messaging for all ${targetList.length} shipments!`);
    }
  };

  const handleInsertTag = (tag: string) => {
    setMessageTemplate((prev) => prev + tag);
  };

  const handleCopyText = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(messageTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sentCount = Object.values(sentMap).filter(Boolean).length;
  const validPhoneList = targetList.filter((s) => Boolean(getCleanPhone(s.mobileNumber)));

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isBulk ? `Bulk WhatsApp Dispatch (${targetList.length} Shipments)` : 'Send WhatsApp Notification'}
      size="md"
      footer={
        <div className={styles.footerActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyText}
            leftIcon={<Copy size={14} />}
          >
            {copied ? 'Copied!' : 'Copy Template'}
          </Button>

          <div className={styles.rightActions}>
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
            {isBulk ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleSendNext}
                disabled={validPhoneList.length === 0 || sentCount >= validPhoneList.length}
                leftIcon={<MessageCircle size={15} color="#fff" />}
              >
                {sentCount >= validPhoneList.length
                  ? 'All Dispatched ✓'
                  : `Open Next (${sentCount + 1}/${validPhoneList.length}) →`}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => shipment && handleSendSingle(shipment)}
                disabled={!shipment || !getCleanPhone(shipment.mobileNumber)}
                leftIcon={<Send size={15} />}
              >
                Open WhatsApp Web
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.banner}>
          <Info size={16} />
          <span>
            {isBulk
              ? `Bulk WhatsApp opens a pre-filled chat with your custom message for each customer without typing.`
              : `Pre-filled WhatsApp Web link with customer name and tracking details.`}
          </span>
        </div>

        <div className={styles.textareaGroup}>
          <div className={styles.label}>
            <span>Message Template</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isBulk ? 'Personalized for each customer' : ''}
            </span>
          </div>
          <textarea
            className={styles.textarea}
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            placeholder="Type your WhatsApp message..."
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

        {/* Recipients Queue */}
        <div className={styles.queueSection}>
          <div className={styles.queueHeader}>
            <span>Recipients Queue</span>
            <span className={styles.queueCounter}>
              {sentCount} / {validPhoneList.length} Dispatched
            </span>
          </div>

          <div className={styles.queueList}>
            {targetList.map((s) => {
              const cleanPhone = getCleanPhone(s.mobileNumber);
              const isSent = Boolean(sentMap[s.id]);

              return (
                <div key={s.id} className={styles.queueItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>
                      {s.name || 'Unnamed Recipient'}
                    </span>
                    <span className={styles.itemPhone}>
                      {s.mobileNumber || 'No phone number'} • AWB: {s.awbNumber || '—'}
                    </span>
                  </div>

                  <div className={styles.itemActions}>
                    {isSent ? (
                      <span className={styles.sentBadge}>
                        <CheckCircle2 size={12} /> Sent
                      </span>
                    ) : cleanPhone ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSendSingle(s)}
                        leftIcon={<ExternalLink size={12} color="#16a34a" />}
                      >
                        Send
                      </Button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        No Phone
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}