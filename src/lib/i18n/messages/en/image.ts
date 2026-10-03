/** 画像添付・クロップ・拡大表示・リンクカード（OGP）関連の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const image = {
    "image.alt.dialogAria": "Edit image alt text",
    "image.alt.prompt": "Set alternative text for Bluesky",
    "image.alt.placeholder": "Enter alt text",
    "image.crop.processing": "Processing images...",
    "image.crop.title": "Adjust images",
    "image.crop.caption":
        "Adjust the position and zoom within the 1200 x 630 area.",
    "image.gallery.enlarge": "Enlarge image {index} of {total}",
    "image.lightbox.aria": "Enlarged image",
    "image.lightbox.prev": "Previous image",
    "image.lightbox.next": "Next image",
    "image.picker.overflow":
        "You can attach up to {max} images. The extra images were not added.",
    "image.picker.excludedFromVisual": "Not in Visual",
    "image.picker.removeAria": "Delete image {index}",
    "image.picker.altAria": "Edit alt text for image {index}",
    "image.picker.preparing": "Generating image preview...",
    "image.picker.addAria": "Add images",
    "image.picker.adjustThumbnail": "Adjust thumbnail",
    "image.ogp.button": "Fetch link card",
    "image.ogp.loading": "Fetching OGP…",
    "image.ogp.imageAlt": "OGP image of the detected URL",
    "image.ogp.fetchFailed": "Failed to fetch the link card.",
    "image.ogp.noImage": "No link card image was found.",
    "image.ogp.imageFetchFailed": "Failed to fetch the link card image.",
    "image.ogp.imageInvalidType": "The link card image format is invalid.",
    "image.ogp.imageConvertFailed": "Failed to convert the link card image.",
    "image.ogp.fetched": "Fetched the link card: {url}",
    "image.ogp.error": "An error occurred while fetching the link card.",
} satisfies MessageEntries
