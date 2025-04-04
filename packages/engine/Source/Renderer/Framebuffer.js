import Check from "../Core/Check.js";
import Frozen from "../Core/Frozen.js";
import defined from "../Core/defined.js";
import destroyObject from "../Core/destroyObject.js";
import DeveloperError from "../Core/DeveloperError.js";
import PixelFormat from "../Core/PixelFormat.js";
import ContextLimits from "./ContextLimits.js";
import PixelDatatype from "./PixelDatatype.js";

function attachTexture(framebuffer, attachment, texture) {
  const gl = framebuffer._gl;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    attachment,
    texture._target,
    texture._texture,
    0,
  );
}

function attachRenderbuffer(framebuffer, attachment, renderbuffer) {
  const gl = framebuffer._gl;
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    attachment,
    gl.RENDERBUFFER,
    renderbuffer._getRenderbuffer(),
  );
}

/**
 * Creates a framebuffer with optional initial color, depth, and stencil attachments.
 * Framebuffers are used for render-to-texture effects; they allow us to render to
 * textures in one pass, and read from it in a later pass.
 *
 * @param {object} options Object with the following properties:
 * @param {Context} options.context
 * @param {Texture[]} [options.colorTextures]
 * @param {Renderbuffer[]} [options.colorRenderbuffers]
 * @param {Texture} [options.depthTexture]
 * @param {Renderbuffer} [options.depthRenderbuffer]
 * @param {Renderbuffer} [options.stencilRenderbuffer]
 * @param {Texture} [options.depthStencilTexture]
 * @param {Renderbuffer} [options.depthStencilRenderbuffer]
 * @param {boolean} [options.destroyAttachments=true] When true, the framebuffer owns its attachments so they will be destroyed when {@link Framebuffer#destroy} is called or when a new attachment is assigned to an attachment point.
 *
 * @exception {DeveloperError} Cannot have both color texture and color renderbuffer attachments.
 * @exception {DeveloperError} Cannot have both a depth texture and depth renderbuffer attachment.
 * @exception {DeveloperError} Cannot have both a depth-stencil texture and depth-stencil renderbuffer attachment.
 * @exception {DeveloperError} Cannot have both a depth and depth-stencil renderbuffer.
 * @exception {DeveloperError} Cannot have both a stencil and depth-stencil renderbuffer.
 * @exception {DeveloperError} Cannot have both a depth and stencil renderbuffer.
 * @exception {DeveloperError} The color-texture pixel-format must be a color format.
 * @exception {DeveloperError} The depth-texture pixel-format must be DEPTH_COMPONENT.
 * @exception {DeveloperError} The depth-stencil-texture pixel-format must be DEPTH_STENCIL.
 * @exception {DeveloperError} The number of color attachments exceeds the number supported.
 * @exception {DeveloperError} The color-texture pixel datatype is HALF_FLOAT and the WebGL implementation does not support the EXT_color_buffer_half_float extension.
 * @exception {DeveloperError} The color-texture pixel datatype is FLOAT and the WebGL implementation does not support the EXT_color_buffer_float or WEBGL_color_buffer_float extensions.
 *
 * @example
 * // Create a framebuffer with color and depth texture attachments.
 * const width = context.canvas.clientWidth;
 * const height = context.canvas.clientHeight;
 * const framebuffer = new Framebuffer({
 *   context : context,
 *   colorTextures : [new Texture({
 *     context : context,
 *     width : width,
 *     height : height,
 *     pixelFormat : PixelFormat.RGBA
 *   })],
 *   depthTexture : new Texture({
 *     context : context,
 *     width : width,
 *     height : height,
 *     pixelFormat : PixelFormat.DEPTH_COMPONENT,
 *     pixelDatatype : PixelDatatype.UNSIGNED_SHORT
 *   })
 * });
 *
 * @private
 * @constructor
 */
function Framebuffer(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const context = options.context;
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", context);
  //>>includeEnd('debug');

  const gl = context._gl;
  const maximumColorAttachments = ContextLimits.maximumColorAttachments;

  this._gl = gl;
  this._framebuffer = gl.createFramebuffer();

  this._colorTextures = [];
  this._colorRenderbuffers = [];
  this._activeColorAttachments = [];

  this._depthTexture = undefined;
  this._depthRenderbuffer = undefined;
  this._stencilRenderbuffer = undefined;
  this._depthStencilTexture = undefined;
  this._depthStencilRenderbuffer = undefined;

  /**
   * When true, the framebuffer owns its attachments so they will be destroyed when
   * {@link Framebuffer#destroy} is called or when a new attachment is assigned
   * to an attachment point.
   *
   * @type {boolean}
   * @default true
   *
   * @see Framebuffer#destroy
   */
  this.destroyAttachments = options.destroyAttachments ?? true;

  // Throw if a texture and renderbuffer are attached to the same point.  This won't
  // cause a WebGL error (because only one will be attached), but is likely a developer error.

  //>>includeStart('debug', pragmas.debug);
  if (defined(options.colorTextures) && defined(options.colorRenderbuffers)) {
    throw new DeveloperError(
      "Cannot have both color texture and color renderbuffer attachments.",
    );
  }
  if (defined(options.depthTexture) && defined(options.depthRenderbuffer)) {
    throw new DeveloperError(
      "Cannot have both a depth texture and depth renderbuffer attachment.",
    );
  }
  if (
    defined(options.depthStencilTexture) &&
    defined(options.depthStencilRenderbuffer)
  ) {
    throw new DeveloperError(
      "Cannot have both a depth-stencil texture and depth-stencil renderbuffer attachment.",
    );
  }

  // Avoid errors defined in Section 6.5 of the WebGL spec
  const depthAttachment =
    defined(options.depthTexture) || defined(options.depthRenderbuffer);
  const depthStencilAttachment =
    defined(options.depthStencilTexture) ||
    defined(options.depthStencilRenderbuffer);
  if (depthAttachment && depthStencilAttachment) {
    throw new DeveloperError(
      "Cannot have both a depth and depth-stencil attachment.",
    );
  }
  if (defined(options.stencilRenderbuffer) && depthStencilAttachment) {
    throw new DeveloperError(
      "Cannot have both a stencil and depth-stencil attachment.",
    );
  }
  if (depthAttachment && defined(options.stencilRenderbuffer)) {
    throw new DeveloperError(
      "Cannot have both a depth and stencil attachment.",
    );
  }
  //>>includeEnd('debug');

  this._bind();

  if (defined(options.colorTextures)) {
    const textures = options.colorTextures;
    const length =
      (this._colorTextures.length =
      this._activeColorAttachments.length =
        textures.length);

    //>>includeStart('debug', pragmas.debug);
    if (length > maximumColorAttachments) {
      throw new DeveloperError(
        "The number of color attachments exceeds the number supported.",
      );
    }
    //>>includeEnd('debug');

    for (let i = 0; i < length; ++i) {
      const texture = textures[i];

      //>>includeStart('debug', pragmas.debug);
      if (!PixelFormat.isColorFormat(texture.pixelFormat)) {
        throw new DeveloperError(
          "The color-texture pixel-format must be a color format.",
        );
      }
      if (
        texture.pixelDatatype === PixelDatatype.FLOAT &&
        !context.colorBufferFloat
      ) {
        throw new DeveloperError(
          "The color texture pixel datatype is FLOAT and the WebGL implementation does not support the EXT_color_buffer_float or WEBGL_color_buffer_float extensions. See Context.colorBufferFloat.",
        );
      }
      if (
        texture.pixelDatatype === PixelDatatype.HALF_FLOAT &&
        !context.colorBufferHalfFloat
      ) {
        throw new DeveloperError(
          "The color texture pixel datatype is HALF_FLOAT and the WebGL implementation does not support the EXT_color_buffer_half_float extension. See Context.colorBufferHalfFloat.",
        );
      }
      //>>includeEnd('debug');

      const attachmentEnum = this._gl.COLOR_ATTACHMENT0 + i;
      attachTexture(this, attachmentEnum, texture);
      this._activeColorAttachments[i] = attachmentEnum;
      this._colorTextures[i] = texture;
    }
  }

  if (defined(options.colorRenderbuffers)) {
    const renderbuffers = options.colorRenderbuffers;
    const length =
      (this._colorRenderbuffers.length =
      this._activeColorAttachments.length =
        renderbuffers.length);

    //>>includeStart('debug', pragmas.debug);
    if (length > maximumColorAttachments) {
      throw new DeveloperError(
        "The number of color attachments exceeds the number supported.",
      );
    }
    //>>includeEnd('debug');

    for (let i = 0; i < length; ++i) {
      const renderbuffer = renderbuffers[i];
      const attachmentEnum = this._gl.COLOR_ATTACHMENT0 + i;
      attachRenderbuffer(this, attachmentEnum, renderbuffer);
      this._activeColorAttachments[i] = attachmentEnum;
      this._colorRenderbuffers[i] = renderbuffer;
    }
  }

  if (defined(options.depthTexture)) {
    const texture = options.depthTexture;

    //>>includeStart('debug', pragmas.debug);
    if (texture.pixelFormat !== PixelFormat.DEPTH_COMPONENT) {
      throw new DeveloperError(
        "The depth-texture pixel-format must be DEPTH_COMPONENT.",
      );
    }
    //>>includeEnd('debug');

    attachTexture(this, this._gl.DEPTH_ATTACHMENT, texture);
    this._depthTexture = texture;
  }

  if (defined(options.depthRenderbuffer)) {
    const renderbuffer = options.depthRenderbuffer;
    attachRenderbuffer(this, this._gl.DEPTH_ATTACHMENT, renderbuffer);
    this._depthRenderbuffer = renderbuffer;
  }

  if (defined(options.stencilRenderbuffer)) {
    const renderbuffer = options.stencilRenderbuffer;
    attachRenderbuffer(this, this._gl.STENCIL_ATTACHMENT, renderbuffer);
    this._stencilRenderbuffer = renderbuffer;
  }

  if (defined(options.depthStencilTexture)) {
    const texture = options.depthStencilTexture;

    //>>includeStart('debug', pragmas.debug);
    if (texture.pixelFormat !== PixelFormat.DEPTH_STENCIL) {
      throw new DeveloperError(
        "The depth-stencil pixel-format must be DEPTH_STENCIL.",
      );
    }
    //>>includeEnd('debug');

    attachTexture(this, this._gl.DEPTH_STENCIL_ATTACHMENT, texture);
    this._depthStencilTexture = texture;
  }

  if (defined(options.depthStencilRenderbuffer)) {
    const renderbuffer = options.depthStencilRenderbuffer;
    attachRenderbuffer(this, this._gl.DEPTH_STENCIL_ATTACHMENT, renderbuffer);
    this._depthStencilRenderbuffer = renderbuffer;
  }

  this._unBind();
}

Object.defineProperties(Framebuffer.prototype, {
  /**
   * The status of the framebuffer. If the status is not WebGLConstants.FRAMEBUFFER_COMPLETE,
   * a {@link DeveloperError} will be thrown when attempting to render to the framebuffer.
   * @memberof Framebuffer.prototype
   * @type {number}
   */
  status: {
    get: function () {
      this._bind();
      const status = this._gl.checkFramebufferStatus(this._gl.FRAMEBUFFER);
      this._unBind();
      return status;
    },
  },
  numberOfColorAttachments: {
    get: function () {
      return this._activeColorAttachments.length;
    },
  },
  depthTexture: {
    get: function () {
      return this._depthTexture;
    },
  },
  depthRenderbuffer: {
    get: function () {
      return this._depthRenderbuffer;
    },
  },
  stencilRenderbuffer: {
    get: function () {
      return this._stencilRenderbuffer;
    },
  },
  depthStencilTexture: {
    get: function () {
      return this._depthStencilTexture;
    },
  },
  depthStencilRenderbuffer: {
    get: function () {
      return this._depthStencilRenderbuffer;
    },
  },

  /**
   * True if the framebuffer has a depth attachment.  Depth attachments include
   * depth and depth-stencil textures, and depth and depth-stencil renderbuffers.  When
   * rendering to a framebuffer, a depth attachment is required for the depth test to have effect.
   * @memberof Framebuffer.prototype
   * @type {boolean}
   */
  hasDepthAttachment: {
    get: function () {
      return !!(
        this.depthTexture ||
        this.depthRenderbuffer ||
        this.depthStencilTexture ||
        this.depthStencilRenderbuffer
      );
    },
  },
});

Framebuffer.prototype._bind = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype._unBind = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

Framebuffer.prototype.bindDraw = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype.bindRead = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype._getActiveColorAttachments = function () {
  return this._activeColorAttachments;
};

Framebuffer.prototype.getColorTexture = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index) || index < 0 || index >= this._colorTextures.length) {
    throw new DeveloperError(
      "index is required, must be greater than or equal to zero and must be less than the number of color attachments.",
    );
  }
  //>>includeEnd('debug');

  return this._colorTextures[index];
};

Framebuffer.prototype.getColorRenderbuffer = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (
    !defined(index) ||
    index < 0 ||
    index >= this._colorRenderbuffers.length
  ) {
    throw new DeveloperError(
      "index is required, must be greater than or equal to zero and must be less than the number of color attachments.",
    );
  }
  //>>includeEnd('debug');

  return this._colorRenderbuffers[index];
};

Framebuffer.prototype.isDestroyed = function () {
  return false;
};

Framebuffer.prototype.destroy = function () {
  if (this.destroyAttachments) {
    // If the color texture is a cube map face, it is owned by the cube map, and will not be destroyed.
    const textures = this._colorTextures;
    for (let i = 0; i < textures.length; ++i) {
      const texture = textures[i];
      if (defined(texture)) {
        texture.destroy();
      }
    }

    const renderbuffers = this._colorRenderbuffers;
    for (let i = 0; i < renderbuffers.length; ++i) {
      const renderbuffer = renderbuffers[i];
      if (defined(renderbuffer)) {
        renderbuffer.destroy();
      }
    }

    this._depthTexture = this._depthTexture && this._depthTexture.destroy();
    this._depthRenderbuffer =
      this._depthRenderbuffer && this._depthRenderbuffer.destroy();
    this._stencilRenderbuffer =
      this._stencilRenderbuffer && this._stencilRenderbuffer.destroy();
    this._depthStencilTexture =
      this._depthStencilTexture && this._depthStencilTexture.destroy();
    this._depthStencilRenderbuffer =
      this._depthStencilRenderbuffer &&
      this._depthStencilRenderbuffer.destroy();
  }

  this._gl.deleteFramebuffer(this._framebuffer);
  return destroyObject(this);
};
export default Framebuffer;
