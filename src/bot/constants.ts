export const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>"`{}|\\^[\]]+|(?:[\w-]+\.)+(?:com|net|org|io|gg|tv|me|co|app|xyz|dev|gov|edu|info|biz|us|uk|id|jp|fr|de|ru|cn|br|in|au|ca|nl|se|es|it|pl|tr|kr|nz|ar|mx|sa|ae|sg|hk|tw|my|th|vn|ph|nl|gr|cz|fi|no|dk|be|pt|ie|ch|at|hu|ro|ua|il|za|cl|pe|ve|ec|uy|py|bo|cr|gt|hn|ni|pa|do|cu|jm|tt|bs|bb|gd|lc|vc|kn|ag|dm)(?:\/[^\s]*)?/gi;

export const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
  "tiff", "svg", "heic", "heif", "avif",
]);

export const IMAGE_CONTENT_TYPE_PREFIX = "image/";
