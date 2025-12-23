// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Typing Animation
    let typingTimeout;

    function typeText(element, text) {
        element.textContent = '';
        let charIndex = 0;

        function typeCharacter() {
            if (charIndex < text.length) {
                element.textContent += text.charAt(charIndex);
                charIndex++;
                typingTimeout = setTimeout(typeCharacter, 75);
            }
        }

        typeCharacter();
    }

    function startTypingAnimation(section) {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        const typingElement = section.querySelector('.typing-text');
        if (typingElement) {
            const textToType = typingElement.getAttribute('data-text');
            typeText(typingElement, textToType);
        }
    }

    // Tab Navigation System
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    // Function to switch between sections
    function switchSection(targetSection) {
        navItems.forEach(item => item.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));

        const clickedNavItem = document.querySelector(`[data-section="${targetSection}"]`);
        if (clickedNavItem) {
            clickedNavItem.classList.add('active');
        }

        const targetSectionElement = document.getElementById(targetSection);
        if (targetSectionElement) {
            targetSectionElement.classList.add('active');
            startTypingAnimation(targetSectionElement);
        }
    }

    // Add click event listeners to navigation items
    navItems.forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            switchSection(this.getAttribute('data-section'));
        });
    });

    // Initialize with home section active and start typing animation
    const homeSection = document.getElementById('home');
    if (homeSection) {
        startTypingAnimation(homeSection);
    }

    // Image Modal Functionality
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.modal-close');
    const catImages = document.querySelectorAll('.cat-image');

    // Open modal when clicking on cat images
    catImages.forEach(catImage => {
        catImage.addEventListener('click', function() {
            modal.style.display = 'block';
            modalImg.src = this.getAttribute('data-image');
        });
    });

    // Close modal when clicking the X button
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside the image
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });

    // Handle overflow
    function handleOverflow() {
        if (window.innerWidth <= 768) {
            document.body.style.overflow = 'auto';
        } else {
            document.body.style.overflow = 'hidden';
            const rightPanel = document.querySelector('.right-panel');
            if (rightPanel) {
                rightPanel.style.overflowY = 'auto';
            }
        }
    }

    handleOverflow();
    window.addEventListener('resize', handleOverflow);
});