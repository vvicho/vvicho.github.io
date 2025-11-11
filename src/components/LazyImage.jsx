import React, { useEffect, useRef, useState } from "react";

export default function LazyImage({ src, alt = "", className, style, placeholderClassName = "", onClick }) {
  const imgRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [imgRef.current]);

  const mergedStyle = { width: '100%', height: 'auto', ...style };
  return (
    <div ref={imgRef} className={placeholderClassName} style={mergedStyle} onClick={onClick}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ display: 'block', width: '100%', height: 'auto', opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
        />
      )}
    </div>
  );
}


