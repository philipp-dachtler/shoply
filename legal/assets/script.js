document.addEventListener('DOMContentLoaded', function() {
    const bttBtn = document.querySelector('.btt-btn');
    const scrollElements = document.querySelectorAll('[data-scroll-to-id]');
    
    
    window.addEventListener('scroll', toggleBttButton);
    
    bttBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    scrollElements.forEach(element => {
        element.addEventListener('click', function() {
            const targetId = this.getAttribute('data-scroll-to-id');
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    function toggleBttButton() {
        bttBtn.style.display = (window.scrollY > 100) ? 'block' : 'none';
    }

	function generateStyles() {
		const elements = document.querySelectorAll('*');
		const styles = new Set();

		elements.forEach(element => {
			const classList = element.classList;

			classList.forEach(cls => {
				if (cls.startsWith('w') || cls.startsWith('h')) {
					const parts = cls.substring(1).split('-');
					const value = parts[0];
					const decimal = parts[1] ? '.' + parts[1] : '';
					const finalValue = value + decimal;
					const property = cls.charAt(0) === 'w' ? 'width' : 'height';

					if (!isNaN(finalValue)) {
						styles.add(`.${cls} { ${property}: ${finalValue}px; }`);
					}
				}
			});
		});

		return Array.from(styles).join('\n');
	}

	const styles = generateStyles();
	const styleTag = document.createElement('style');
	styleTag.type = 'text/css';
	styleTag.appendChild(document.createTextNode(styles));
	document.head.appendChild(styleTag);


	setTimeout(() => {
		console.log(`Generated CSS Snippets: ${styles.split('\n').length}`);
	}, 10);
    
    toggleBttButton();
});