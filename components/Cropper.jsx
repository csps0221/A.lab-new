'use client';
import { useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { cropToB64 } from '@/lib/client';

export default function Cropper({ src, onChange }) {
  const ref = useRef(null);
  const [crop, setCrop] = useState();
  return (
    <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => ref.current && onChange(cropToB64(ref.current, c))}>
      <img
        ref={ref}
        src={src}
        alt="題目圖片"
        style={{ maxWidth: '100%' }}
        onLoad={(e) => onChange(cropToB64(e.currentTarget, null))}
      />
    </ReactCrop>
  );
}
