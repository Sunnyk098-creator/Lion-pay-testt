(function() {
    let savedTheme = localStorage.getItem('lp_theme') || 'light';
    let savedColor = localStorage.getItem('lp_color') || '#f59e0b'; 
    let savedPremium = localStorage.getItem('lp_premiumUI') === 'true';
    let savedColorful = localStorage.getItem('lp_colorful') === 'true';
    let savedNeon = localStorage.getItem('lp_neon') === 'true';
    let savedVisuals = localStorage.getItem('lp_visuals') === 'true';

    if(savedTheme === 'dark') document.documentElement.classList.add('dark-mode');
    if(savedPremium) document.documentElement.classList.add('premium-mode');
    if(savedColorful) document.documentElement.classList.add('colorful-mode');
    if(savedNeon) document.documentElement.classList.add('neon-active');
    if(savedVisuals) document.documentElement.classList.add('better-visuals-active');

    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    document.documentElement.style.setProperty('--accent-main', savedColor);
    document.documentElement.style.setProperty('--accent-glow', hexToRgba(savedColor, 0.4));
    document.documentElement.style.setProperty('--premium-grad-1', hexToRgba(savedColor, 0.15));
    document.documentElement.style.setProperty('--premium-grad-2', hexToRgba(savedColor, 0.05));
})();
