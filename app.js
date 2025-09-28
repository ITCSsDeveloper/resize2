 Dropzone.autoDiscover = false;
    const uploadedFiles = [];
    const convertedFiles = []; // Stores objects with { file: File, dataUrl: String }

    document.addEventListener('DOMContentLoaded', () => {
        const dropzoneElement = document.getElementById('image-dropzone');
        const convertButton = document.getElementById('convert-button');
        const saveAllButton = document.getElementById('save-all-button');
        const outputPreviews = document.getElementById('output-previews');
        const resizeSizeSelect = document.getElementById('resize-size');
        const jpegQualitySelect = document.getElementById('jpeg-quality');

        // Initialize Dropzone
        new Dropzone(dropzoneElement, {
            url: "#", // Dummy URL, as we process client-side
            autoProcessQueue: false,
            acceptedFiles: "image/*",
            addRemoveLinks: true,
            dictDefaultMessage: "",
            init: function() {
                const myDropzone = this;
                myDropzone.on("addedfile", file => {
                    uploadedFiles.push(file);
                });
                myDropzone.on("removedfile", file => {
                    const index = uploadedFiles.indexOf(file);
                    if (index > -1) {
                        uploadedFiles.splice(index, 1);
                    }
                });
            }
        });

        convertButton.addEventListener('click', async () => {
            if (uploadedFiles.length === 0) {
                alert("Please upload at least one image.");
                return;
            }

            const convertSpinner = document.getElementById('convert-spinner');
            const convertText = document.getElementById('convert-text');
            convertSpinner.classList.remove('d-none');
            convertText.textContent = "Converting...";
            convertButton.disabled = true;

            convertedFiles.length = 0; // Clear previous converted files
            outputPreviews.innerHTML = ''; // Clear previous previews

            const targetMpx = parseFloat(resizeSizeSelect.value);
            const jpegQuality = parseInt(jpegQualitySelect.value, 10) / 100;
            const targetPx = Math.sqrt(targetMpx * 1000000); // Calculate dimension for target Mpx

            for (const file of uploadedFiles) {
                try {
                    // 1. อ่านไฟล์เป็น Image
                    const img = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const image = new Image();
                            image.onload = () => resolve(image);
                            image.onerror = reject;
                            image.src = e.target.result;
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    // 2. คำนวณขนาดใหม่ (รักษาอัตราส่วน)
                    let { width, height } = img;
                    const aspect = width / height;
                    if (width >= height) {
                        width = targetPx;
                        height = Math.round(targetPx / aspect);
                    } else {
                        height = targetPx;
                        width = Math.round(targetPx * aspect);
                    }

                    // 3. วาดลง Canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 4. แปลงเป็น Blob (JPEG)
                    const blob = await new Promise(resolve => 
                        canvas.toBlob(resolve, 'image/jpeg', jpegQuality)
                    );

                    // 5. สร้างไฟล์ใหม่
                    const resizedFile = new File(
                        [blob],
                        file.name.replace(/\.[^/.]+$/, "") + `_resized.jpg`, // ใช้ .jpg เสมอ
                        { type: 'image/jpeg', lastModified: Date.now() }
                    );

                    // 6. แสดง preview
                    const dataUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.readAsDataURL(resizedFile);
                    });

                    convertedFiles.push({ file: resizedFile, dataUrl: dataUrl });

                    // Create preview element
                    const previewItem = document.createElement('div');
                    previewItem.className = 'image-preview-item card my-2';
                    previewItem.innerHTML = `
                        <div class="card-body">
                            <img src="${dataUrl}" class="img-fluid mb-2" alt="Resized image preview">
                            <p class="card-text text-muted small">${resizedFile.name}</p>
                            <button class="btn btn-sm btn-primary view-image me-2" data-src="${dataUrl}">View</button>
                            <button class="btn btn-sm btn-secondary save-image" data-filename="${resizedFile.name}" data-src="${dataUrl}">Save</button>
                        </div>
                    `;
                    outputPreviews.appendChild(previewItem);

                } catch (error) {
                    console.error("Error during image resize:", error);
                    alert(`An error occurred while processing ${file.name}.`);
                }
            }

            convertSpinner.classList.add('d-none');
            convertText.textContent = "Convert";
            convertButton.disabled = false;
            saveAllButton.style.display = 'block';
        });

        // Event delegation for View and Save buttons
        outputPreviews.addEventListener('click', (event) => {
            if (event.target.classList.contains('view-image')) {
                const dataSrc = event.target.dataset.src;
                // สร้าง Blob URL แทนการเปิด data URL ตรง ๆ
                fetch(dataSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                        // ลบ blob url เมื่อแท็บถูกปิด (optional)
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                    });
            } else if (event.target.classList.contains('save-image')) {
                const fileName = event.target.dataset.filename;
                const dataSrc = event.target.dataset.src;
                // Convert data URL to Blob for saving
                fetch(dataSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        saveAs(blob, fileName);
                    })
                    .catch(error => {
                        console.error("Error saving image:", error);
                        alert("Could not save the image.");
                    });
            }
        });

        saveAllButton.addEventListener('click', async () => {
            if (convertedFiles.length === 0) {
                alert("No files to download.");
                return;
            }

            const saveSpinner = document.getElementById('save-spinner');
            const saveText = document.getElementById('save-text');
            saveSpinner.classList.remove('d-none');
            saveText.textContent = "Zipping...";
            saveAllButton.disabled = true;

            const zip = new JSZip();
            convertedFiles.forEach(item => {
                zip.file(item.file.name, item.file);
            });

            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, "resized_images.zip");
            
            saveSpinner.classList.add('d-none');
            saveText.textContent = "Download All (.zip)";
            saveAllButton.disabled = false;
        });

        // เพิ่มปุ่ม Convert for Facebook & IG
        const fbIgConvertBtn = document.getElementById('fb-ig-convert-btn');
        if (fbIgConvertBtn) {
            fbIgConvertBtn.addEventListener('click', async () => {
                if (uploadedFiles.length === 0) {
                    alert("Please upload at least one image.");
                    return;
                }

                const outputPreviews = document.getElementById('output-previews');
                const saveAllButton = document.getElementById('save-all-button');
                const convertButton = document.getElementById('convert-button');
                const convertSpinner = document.getElementById('convert-spinner');
                const convertText = document.getElementById('convert-text');

                convertSpinner.classList.remove('d-none');
                convertText.textContent = "Converting...";
                convertButton.disabled = true;
                fbIgConvertBtn.disabled = true;

                convertedFiles.length = 0;
                outputPreviews.innerHTML = '';

                // Facebook/IG recommend 2048px max width/height, quality 99
                const targetPx = 2048;
                const qualityOptions = [0.90];

                for (const file of uploadedFiles) {
                    try {
                        const img = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const image = new Image();
                                image.onload = () => resolve(image);
                                image.onerror = reject;
                                image.src = e.target.result;
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });

                        let { width, height } = img;
                        let newWidth = width, newHeight = height;
                        if (width > height) {
                            newWidth = targetPx;
                            newHeight = Math.round(targetPx * height / width);
                        } else {
                            newHeight = targetPx;
                            newWidth = Math.round(targetPx * width / height);
                        }

                        for (const q of qualityOptions) {
                            const canvas = document.createElement('canvas');
                            canvas.width = newWidth;
                            canvas.height = newHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, newWidth, newHeight);

                            const blob = await new Promise(resolve =>
                                canvas.toBlob(resolve, 'image/jpeg', q)
                            );

                            const qualityLabel = Math.round(q * 100);
                            const resizedFile = new File(
                                [blob],
                                file.name.replace(/\.[^/.]+$/, "") + `_fb-ig_${qualityLabel}.jpg`,
                                { type: 'image/jpeg', lastModified: Date.now() }
                            );

                            const dataUrl = await new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = e => resolve(e.target.result);
                                reader.readAsDataURL(resizedFile);
                            });

                            convertedFiles.push({ file: resizedFile, dataUrl: dataUrl });

                            // Create preview element
                            const previewItem = document.createElement('div');
                            previewItem.className = 'image-preview-item card my-2';
                            previewItem.innerHTML = `
                                <div class="card-body">
                                    <img src="${dataUrl}" class="img-fluid mb-2" alt="Resized image preview">
                                    <p class="card-text text-muted small">${resizedFile.name}</p>
                                    <button class="btn btn-sm btn-primary view-image me-2" data-src="${dataUrl}">View</button>
                                    <button class="btn btn-sm btn-secondary save-image" data-filename="${resizedFile.name}" data-src="${dataUrl}">Save</button>
                                </div>
                            `;
                            outputPreviews.appendChild(previewItem);
                        }
                    } catch (error) {
                        console.error("Error during FB/IG image resize:", error);
                        alert(`An error occurred while processing ${file.name}.`);
                    }
                }

                convertSpinner.classList.add('d-none');
                convertText.textContent = "Convert";
                convertButton.disabled = false;
                fbIgConvertBtn.disabled = false;
                saveAllButton.style.display = 'block';
            });
        }
    });