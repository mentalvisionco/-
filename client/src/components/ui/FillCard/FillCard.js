'use client';
import styles from './FillCard.module.css';
import Image from 'next/image';

export default function FillCard({ count = 0 }) {
  const totalCircles = 12;
  const circles = Array.from({ length: totalCircles }, (_, i) => i < count);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardInner}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.logoLeft}>
            <Image src="/logo.svg" alt="Mental Vision" width={80} height={26} />
          </div>
          <div className={styles.titleBox}>
            <h2>FILL CARD</h2>
          </div>
          <div className={styles.logoRight}>
            {/* Using a placeholder or simple icon for the right logo since we don't have the exact image */}
            <div className={styles.placeholderLogo}>
              <span>Ghaith</span>
            </div>
          </div>
        </div>

        {/* Circles Grid */}
        <div className={styles.grid}>
          {circles.map((isFilled, index) => (
            <div key={index} className={`${styles.circle} ${isFilled ? styles.filled : ''}`}>
              {isFilled && (
                <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
