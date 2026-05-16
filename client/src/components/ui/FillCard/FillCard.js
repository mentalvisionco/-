'use client';
import styles from './FillCard.module.css';
import Image from 'next/image';

export default function FillCard({ count = 0 }) {
  const totalCircles = 12;
  const circles = Array.from({ length: totalCircles }, (_, i) => i < count);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardInner}>
        {/* Double border effect */}
        <div className={styles.cardBorder}>
          {/* Header Section */}
          <div className={styles.header}>
            <div className={styles.logoLeft}>
              <Image src="/ghaith-logo.svg" alt="Ghaith Logo" width={80} height={60} className={styles.ghaithImage} />
            </div>
            
            <div className={styles.titleBox}>
              <h2>FILL CARD</h2>
            </div>
            
            <div className={styles.logoRight}>
              <Image src="/logo.svg" alt="Mental Vision Logo" width={100} height={50} className={styles.mentalImage} />
            </div>
          </div>

          {/* Circles Grid */}
          <div className={styles.grid}>
            {circles.map((isFilled, index) => (
              <div key={index} className={styles.circle}>
                {isFilled && (
                  <div className={styles.stamp}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
