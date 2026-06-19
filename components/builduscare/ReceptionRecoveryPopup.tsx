"use client";

import { useState } from "react";
import styles from "./ReceptionRecoveryPopup.module.css";

export function ReceptionRecoveryPopup() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <section className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="reception-recovery-title">
      <div className={styles.modal}>
        <div className={styles.head}>
          <div className={styles.kicker}>Build us Care 안내</div>
          <h2 id="reception-recovery-title" className={styles.title}>
            접수 기능 복구 중입니다
          </h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>
            현재 접수 과정에서 오류가 확인되어 복구 작업을 진행하고 있습니다.
            빠른 시일 내에 정상 이용하실 수 있도록 조치하겠습니다.
          </p>
          <div className={styles.notice}>
            접수를 원하시는 고객님은 카톡 상담으로 안내 도와드리고 있습니다.
            불편을 드려 죄송합니다.
          </div>
          <div className={styles.qrPanel}>
            <img src="/assets/kakao-consult-qr.png" alt="Build us Care 카톡 상담 QR 코드" />
            <div>
              <strong className={styles.qrTitle}>카톡 상담 QR</strong>
              <span className={styles.qrText}>휴대폰 카메라로 QR을 스캔하면 카톡 상담으로 연결됩니다.</span>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.confirmButton} type="button" onClick={() => setIsOpen(false)}>
              확인
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
