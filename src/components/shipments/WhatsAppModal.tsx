'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './WhatsAppModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shipment } from '@/types/shipment';
import { formatWhatsAppPhone, getCourierTrackingInfo } from '@/lib/shipments';
import { shipmentService } from '@/lib/services/shipment.service';
import { Send, CheckCircle2, MessageCircle, ExternalLink, Info, Copy, Smartphone } from 'lucide-react';

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
  // Support both READY and SHIPPED shipments, or all provided
  const targetShipment = shipment || null;
  const isBulk = shipments.length > 0;
  const targetList = useMemo(
    () => (isBulk ? shipments : targetShipment ? [targetShipment] : []),
    [isBulk, shipments, targetShipment]
  );

  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSentMap({});

    if (isBulk) {
      setMessageTemplate(
        'Namaste {name}! 🙏\n\n' +
        'Thank you for ordering with Draupadi Fashion! 📦✨\n' +
        'Your parcel has been dispatched and is on its way to you!\n\n' +
        '📋 Order & Tracking Information:\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        '🔖 Tracking ID: {tracking_id}\n' +
        '🚚 Courier Partner: {courier}\n' +
        '📍 Destination: {city}\n' +
        '━━━━━━━━━━━━━━━━━━━\n\n' +
        'Thank you for shopping with Draupadi Fashion, Biaora!'
      );
    } else if (targetShipment) {
      setRecipientPhone(targetShipment.mobileNumber || '');

      const name = targetShipment.name || 'Customer';
      const tracking = targetShipment.trackingId || targetShipment.awbNumber || 'Pending / N/A';
      const courierInfo = getCourierTrackingInfo(targetShipment.courierPartnerName, tracking);
      const location = [targetShipment.city, targetShipment.state].filter(Boolean).join(', ') || 'Your address';
      const trackLinkText = courierInfo.trackingUrl ? `\n🌐 Track Online: ${courierInfo.trackingUrl}` : '';
      const howToTrack = courierInfo.trackingUrl
        ? `\n\n💡 How to track:\nVisit the tracking link above and enter your Tracking ID: ${tracking}`
        : '';

      if (targetShipment.status === 'SHIPPED') {
        setMessageTemplate(
          `Namaste ${name}! 🙏\n\n` +
          `Great news! Your parcel from Draupadi Fashion has been dispatched and is on its way to you! 🚚💨\n\n` +
          `📋 Live Tracking Information:\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🔖 Tracking ID: ${tracking}\n` +
          `🚚 Courier Partner: ${courierInfo.name}\n` +
          `📍 Delivery To: ${location}` +
          `${trackLinkText}\n` +
          `━━━━━━━━━━━━━━━━━━━` +
          `${howToTrack}\n\n` +
          `Thank you for trusting Draupadi Fashion, Biaora!`
        );
      } else {
        setMessageTemplate(
          `Namaste ${name}! 🙏\n\n` +
          `Thank you for ordering with Draupadi Fashion! 📦✨\n` +
          `Your parcel is packaged and prepared for dispatch.\n\n` +
          `📋 Order & Tracking Information:\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🔖 Tracking ID: ${tracking}\n` +
          `🚚 Courier Partner: ${courierInfo.name}\n` +
          `📍 Delivery To: ${location}` +
          `${trackLinkText}\n` +
          `━━━━━━━━━━━━━━━━━━━` +
          `${howToTrack}\n\n` +
          `For any assistance, please reply directly to this message.\n` +
          `Warm regards,\nDraupadi Fashion, Biaora`
        );
      }
    }
  }, [isOpen, targetShipment?.id, isBulk, shipments.length]);

  const buildMessageForShipment = (s: Shipment): string => {
    const tracking = s.trackingId || s.awbNumber || 'Pending / N/A';
    const courierInfo = getCourierTrackingInfo(s.courierPartnerName, tracking);
    return messageTemplate
      .replace(/\{name\}/gi, s.name || 'Customer')
      .replace(/\{awb\}/gi, tracking)
      .replace(/\{tracking_id\}/gi, tracking)
      .replace(/\{courier\}/gi, courierInfo.name)
      .replace(/\{tracking_url\}/gi, courierInfo.trackingUrl)
      .replace(/\{city\}/gi, [s.city, s.state].filter(Boolean).join(', ') || '');
  };

  const handleSendSingle = async (s: Shipment, overridePhone?: string) => {
    const rawPhone = overridePhone !== undefined ? overridePhone : (recipientPhone || s.mobileNumber);
    const cleanPhone = formatWhatsAppPhone(rawPhone);

    if (!cleanPhone) {
      alert(`Please enter a valid 10-digit mobile number for ${s.name || s.id}.`);
      return;
    }

    const text = isBulk ? buildMessageForShipment(s) : messageTemplate;
    // Universal WhatsApp Web / Desktop / Mobile URL
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    try {
      await shipmentService.addEvent(
        s.id,
        'WHATSAPP_OPENED',
        `WhatsApp notification opened for ${cleanPhone} (AWB: ${s.awbNumber || 'N/A'})`
      );
    } catch {
      // safe fallback
    }

    setSentMap((prev) => ({ ...prev, [s.id]: true }));
    onSuccess?.(`WhatsApp opened for ${s.name || cleanPhone}`);
  };

  const handleSendNext = () => {
    const pendingList = targetList.filter((s) => !sentMap[s.id] && formatWhatsAppPhone(s.mobileNumber));
    if (pendingList.length === 0) {
      alert('All selected recipients with valid phone numbers have been messaged!');
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
  const validPhoneList = targetList.filter((s) => Boolean(formatWhatsAppPhone(s.mobileNumber)));

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isBulk ? `Bulk WhatsApp Dispatch (${targetList.length} Shipments)` : 'Send WhatsApp Tracking Notification'}
      size="md"
      footer={
        <div className={styles.footerActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyText}
            leftIcon={<Copy size={14} />}
          >
            {copied ? 'Copied!' : 'Copy Text'}
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
                onClick={() => targetShipment && handleSendSingle(targetShipment, recipientPhone)}
                disabled={!targetShipment || !formatWhatsAppPhone(recipientPhone)}
                leftIcon={<Send size={15} />}
              >
                Send on WhatsApp
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
              ? `Bulk WhatsApp opens a pre-filled chat with Tracking ID for each recipient via WhatsApp Web or App.`
              : `Pre-fills WhatsApp chat with Tracking ID, Courier, and order details. Clicking send opens WhatsApp directly.`}
          </span>
        </div>

        {/* Single Shipment: Editable Recipient Mobile */}
        {!isBulk && targetShipment && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
            <Input
              label="Recipient Mobile Number"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="e.g. 9303003570"
              type="tel"
            />
            <div style={{ paddingBottom: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <strong>Tracking ID / AWB:</strong>{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {targetShipment.trackingId || targetShipment.awbNumber || 'Pending / N/A'}
              </span>
            </div>
          </div>
        )}

        <div className={styles.textareaGroup}>
          <div className={styles.label}>
            <span>Message Content (contains Tracking ID)</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isBulk ? 'Personalized for each customer' : ''}
            </span>
          </div>
          <textarea
            className={styles.textarea}
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            placeholder="Type your WhatsApp message..."
            rows={7}
          />
          <div className={styles.chipsContainer}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Insert:</span>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {name}')}>+ {'{name}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {tracking_id}')}>+ {'{tracking_id}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {courier}')}>+ {'{courier}'}</button>
            <button type="button" className={styles.chip} onClick={() => handleInsertTag(' {city}')}>+ {'{city}'}</button>
          </div>
        </div>

        {/* Recipients Queue in Bulk mode */}
        {isBulk && (
          <div className={styles.queueSection}>
            <div className={styles.queueHeader}>
              <span>Recipients Queue</span>
              <span className={styles.queueCounter}>
                {sentCount} / {validPhoneList.length} Dispatched
              </span>
            </div>

            <div className={styles.queueList}>
              {targetList.map((s) => {
                const cleanPhone = formatWhatsAppPhone(s.mobileNumber);
                const isSent = Boolean(sentMap[s.id]);

                return (
                  <div key={s.id} className={styles.queueItem}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>
                        {s.name || 'Unnamed Recipient'}
                      </span>
                      <span className={styles.itemPhone}>
                        {s.mobileNumber || 'No phone'} • <strong>AWB: {s.awbNumber || '—'}</strong> ({s.courierPartnerName || 'Courier'})
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
        )}
      </div>
    </Modal>
  );
}