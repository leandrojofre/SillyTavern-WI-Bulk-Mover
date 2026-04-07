import {generateUUID, extensionFolderPath, isMobile} from '../../index.js';

export {initTheChosenGnomer, summonTheChosenGnomer};

const daGnomes = Object.freeze([
    'cubic',
    'fighter',
    'noggin',
    'polygonal',
]);

const daGnomesSounds = Object.freeze([
    'wooh',
    'wooh-reverb',
]);

let $gnomeDaImage;
const screenWidth = () => $(window).width();
const screenHeight = () => $(window).height();

// decode once, play many times with low latency
const audioCtx = new AudioContext();
let audioBuffer = null;

async function preloadBuffer(url) {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arr);
}

function playBuffer({ volume = 1, loop = false } = {}) {
    if (!audioBuffer) return;

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = loop;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    src.connect(gain).connect(audioCtx.destination);
    src.start();

    return src;
}

/**
 * @param {number} [min]
 * @param {number} [max]
 * @param {number} [bias]
 * @returns {number}
 */
function randomWithBias(min = 0, max = 100, bias = 1) {
    let random = Math.random();
    random = Math.pow(random, bias);
    return Math.floor(min + (max - min + 1) * random);
}

async function summonTheChosenGnomer() {
    const userWorthinessBarrier = 10;
    const isThyUserWorthyOfDaGnome = randomWithBias(1, userWorthinessBarrier);

    if (isThyUserWorthyOfDaGnome !== userWorthinessBarrier) return;

    const daChosenGnomeId = randomWithBias(0, daGnomes.length - 1);
    const daChosenGnomeAudioId = randomWithBias(0, daGnomesSounds.length - 1, 10);
    const daChosenGnomeSrc = `${extensionFolderPath}/assets/img/gnome-da-${daGnomes[daChosenGnomeId]}.png`;
    const daChosenGnomeAudioSrc = `${extensionFolderPath}/assets/audio/gnome-${daGnomesSounds[daChosenGnomeAudioId]}.mp3`;

    await preloadBuffer(daChosenGnomeAudioSrc).catch(WiBulkMover.error);

    $gnomeDaImage
        .off('load error')
        .one('load', function() {
            const imageWidth = $gnomeDaImage.outerWidth();
            const imageHeight = $gnomeDaImage.outerHeight();
            const inBoundaryPosition = Math.max(randomWithBias(0, screenWidth()) - imageWidth, 0);
            const isReverb = daGnomesSounds[daChosenGnomeAudioId].includes('reverb');

            const animations = {
                start: {left: inBoundaryPosition, top: screenHeight()},
                moveTop: {top: screenHeight() - imageHeight},
                transparent: {opacity: 0},
                opaque: {opacity: 1}
            };

            try {
                $gnomeDaImage
                .stop(true, true)
                .css(animations.start)
                .animate(animations.moveTop, 500)
                .promise()
                .then(function() {
                    audioCtx.resume().then(() => playBuffer({ volume: 0.7 }));

                    if (isReverb) {
                        $gnomeDaImage
                        .animate(animations.transparent, 1000)
                        .delay(1000)
                        .animate(animations.start, 500)
                        .delay(500)
                        .animate(animations.opaque);
                    } else {
                        $gnomeDaImage
                        .delay(500)
                        .animate(animations.start, 500)
                        .delay(500)
                        .animate(animations.opaque);
                    }
                });
            } catch (error) {
                WiBulkMover.error(error);
            }
        })
        .one('error', function () {
            WiBulkMover.error('Could not load gnomed animation or image.');
        });

    if ($gnomeDaImage.css('top') === `${screenHeight()}px`) {
        $gnomeDaImage.prop('src', new URL(daChosenGnomeSrc, window.location.origin).href);
    }
}

function initTheChosenGnomer() {
    const gnomeDaId = `#${generateUUID('gnomed_bozo')}`;

    $gnomeDaImage = $('<img>', {id: gnomeDaId.replace(/^#/, ''), class: 'wi-bulk-mover-custom-css get-gnomed-bozo', alt: 'Get Gnomed Bozo'});
    $gnomeDaImage.appendTo('body');
    $gnomeDaImage.css('top', screenHeight());

    $(window).on('resize', function () {
        if (isMobile()) return;

        $gnomeDaImage.css('top', screenHeight());
    });
}