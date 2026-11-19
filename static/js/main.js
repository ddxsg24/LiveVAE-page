// Load and play each comparison video only while it is on screen.
const videos = document.querySelectorAll('video[data-src]');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, { rootMargin: '200px 0px' });
  videos.forEach((video) => observer.observe(video));
} else {
  videos.forEach((video) => {
    video.src = video.dataset.src;
    video.autoplay = true;
  });
}

document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.target).innerText;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch (err) {
      button.textContent = 'Select and copy';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
});
