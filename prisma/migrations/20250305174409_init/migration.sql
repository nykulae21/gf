-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCollection" (
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId","shop")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "tags" TEXT,
    "shop" TEXT NOT NULL,
    "customMetafields" JSONB NOT NULL,
    "variants" JSONB NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metafield" (
    "id" SERIAL NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "Metafield_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFilter" (
    "id" SERIAL NOT NULL,
    "filter" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "UserFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "themeStoreId" INTEGER,
    "previewable" BOOLEAN NOT NULL,
    "processing" BOOLEAN NOT NULL,
    "adminApiId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterConfig" (
    "shop" TEXT NOT NULL,
    "visibleMetafields" JSONB NOT NULL DEFAULT '[]',
    "includeInCollections" JSONB NOT NULL DEFAULT '[]',
    "excludeFromCollections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterConfig_pkey" PRIMARY KEY ("shop")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_shop_key" ON "Product"("id", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_id_shop_key" ON "Collection"("id", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "Metafield_namespace_key_shop_key" ON "Metafield"("namespace", "key", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_id_shop_key" ON "Theme"("id", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "Template_themeId_name_shop_key" ON "Template"("themeId", "name", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "FilterConfig_shop_key" ON "FilterConfig"("shop");

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_collectionId_shop_fkey" FOREIGN KEY ("collectionId", "shop") REFERENCES "Collection"("id", "shop") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_productId_shop_fkey" FOREIGN KEY ("productId", "shop") REFERENCES "Product"("id", "shop") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_themeId_shop_fkey" FOREIGN KEY ("themeId", "shop") REFERENCES "Theme"("id", "shop") ON DELETE CASCADE ON UPDATE CASCADE;
