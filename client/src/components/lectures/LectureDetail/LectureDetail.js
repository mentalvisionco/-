'use client';
import styles from './LectureDetail.module.css';
import Button from '@/components/ui/Button/Button';
import Textarea from '@/components/ui/Textarea/Textarea';
import RatingStars from '@/components/lectures/RatingStars/RatingStars';
import Card from '@/components/ui/Card/Card';
import { IconArrowRight, IconExternalLink, IconPlay } from '@/components/icons';

function parseVideoUrl(url) {
  if (!url) return { embedUrl: null, isDirectVideo: false, type: 'none' };

  // Google Drive
  const gdFileRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const gdOpenRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
  if (url.includes('drive.google.com')) {
    let fileId = null;
    const fileMatch = url.match(gdFileRegex);
    if (fileMatch) {
      fileId = fileMatch[1];
    } else {
      const openMatch = url.match(gdOpenRegex);
      if (openMatch) fileId = openMatch[1];
    }
    if (fileId) {
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        isDirectVideo: false,
        type: 'google-drive'
      };
    }
  }

  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      isDirectVideo: false,
      type: 'youtube'
    };
  }

  // Direct Video File
  const directVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const isDirect = directVideoExtensions.some(ext => url.toLowerCase().split('?')[0].endsWith(ext));
  if (isDirect) {
    return {
      embedUrl: null,
      isDirectVideo: true,
      type: 'direct'
    };
  }

  // Generic link
  return {
    embedUrl: null,
    isDirectVideo: false,
    type: 'external'
  };
}

export default function LectureDetail({
  lecture,
  currentRating,
  currentComment,
  onRatingChange,
  onCommentChange,
  onSaveRating,
  onBack,
}) {
  if (!lecture) return null;

  const { embedUrl, isDirectVideo, type } = parseVideoUrl(lecture.videoUrl);

  return (
    <div className={styles.wrapper}>
      <Button variant="ghost" size="sm" onClick={onBack} icon={IconArrowRight} iconPosition="start">
        رجوع للمحاضرات
      </Button>

      <Card padding="lg" animate className={styles.mainCard}>
        <h2 className={styles.title}>{lecture.title}</h2>
        {lecture.description && <p className={styles.description}>{lecture.description}</p>}

        {/* Video Player */}
        {lecture.videoUrl && (
          <div className={styles.videoSection}>
            <div className={styles.videoHeader}>
              <span className={styles.videoIcon}>🎥</span>
              <h4 className={styles.videoTitle}>فيديو المحاضرة</h4>
            </div>

            {type === 'external' ? (
              <div className={styles.externalVideoCard}>
                <div className={styles.externalVideoInfo}>
                  <p>رابط المحاضرة مسجل خارج المنصة. اضغط على الزر أدناه لمشاهدة الفيديو.</p>
                </div>
                <a href={lecture.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.watchBtn}>
                  <IconPlay size={16} />
                  <span>فتح رابط المحاضرة</span>
                </a>
              </div>
            ) : (
              <div className={styles.playerContainer}>
                {isDirectVideo ? (
                  <video src={lecture.videoUrl} controls className={styles.videoPlayer} />
                ) : (
                  <iframe
                    src={embedUrl}
                    className={styles.videoIframe}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    title={lecture.title}
                  ></iframe>
                )}
              </div>
            )}
          </div>
        )}

        {/* Material Link */}
        <div className={styles.materialSection}>
          <div className={styles.materialIcon}>📚</div>
          <div className={styles.materialInfo}>
            <h4>ماتيريال المحاضرة</h4>
            <p>يمكنك الوصول إلى محتوى المحاضرة من خلال الرابط أدناه</p>
          </div>
          <a href={lecture.materialUrl} target="_blank" rel="noopener noreferrer" className={styles.materialLink}>
            <span>عرض الماتيريال</span>
            <IconExternalLink size={14} />
          </a>
        </div>

        {/* Rating Section */}
        <div className={styles.ratingSection}>
          <h4 className={styles.ratingTitle}>قيّم هذه المحاضرة</h4>
          <RatingStars value={currentRating} onChange={onRatingChange} size={28} />
          <Textarea
            placeholder="أضف تعليقاً يصف تجربتك في هذه المحاضرة (اختياري)..."
            value={currentComment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
          />
          <Button variant="primary" size="md" onClick={onSaveRating} style={{ alignSelf: 'flex-start' }}>
            حفظ التقييم
          </Button>
        </div>
      </Card>
    </div>
  );
}
