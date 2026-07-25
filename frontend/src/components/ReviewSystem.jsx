import { useState, useContext, useCallback } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { CartContext } from '../App';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Star, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'sonner';

const ReviewSystem = ({ productId, reviews = [], onReviewSubmitted }) => {
  const { API } = useContext(CartContext);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formData, setFormData] = useState({
    user_name: '',
    user_email: '',
    comment: ''
  });
  const [reviewImages, setReviewImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const onDropReviewImages = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(`${API}/v2/upload`, formData);
        setReviewImages(prev => [...prev, response.data.url]);
        toast.success('Image uploaded!');
      } catch (error) {
        toast.error('Failed to upload image');
      }
    }
  }, [API]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onDropReviewImages,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true,
    maxFiles: 3
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await axios.post(`${API}/v2/reviews`, {
        product_id: productId,
        user_name: formData.user_name,
        user_email: formData.user_email,
        rating: rating,
        comment: formData.comment,
        images: reviewImages
      });
      
      toast.success('Review submitted! Awaiting approval.');
      setShowForm(false);
      setFormData({ user_name: '', user_email: '', comment: '' });
      setRating(0);
      setReviewImages([]);
      
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, interactive = false, onRatingChange }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= (interactive ? (hoverRating || value) : value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer' : ''}`}
            onClick={() => interactive && onRatingChange && onRatingChange(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
          />
        ))}
      </div>
    );
  };

  // Calculate average rating
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Reviews Summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold">Customer Reviews</h3>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <StarRating value={Math.round(avgRating)} />
                <span className="text-lg font-semibold">{avgRating.toFixed(1)}</span>
                <span className="text-gray-600">({reviews.length} reviews)</span>
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#d4af37] hover:bg-[#b8941f]"
        >
          {showForm ? 'Cancel' : 'Write a Review'}
        </Button>
      </div>

      {/* Review Form */}
      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Your Rating *</Label>
                <StarRating
                  value={rating}
                  interactive={true}
                  onRatingChange={setRating}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Your Name *</Label>
                  <Input
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Your Email *</Label>
                  <Input
                    type="email"
                    value={formData.user_email}
                    onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Your Review *</Label>
                <Textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  rows={4}
                  placeholder="Share your experience with this product..."
                  required
                />
              </div>

              <div>
                <Label>Add Photos (Optional)</Label>
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed rounded p-4 text-center cursor-pointer hover:border-[#d4af37]"
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Click or drag to upload images (max 3)</p>
                </div>
                {reviewImages.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {reviewImages.map((url, idx) => (
                      <img key={idx} src={resolveImageUrl(url)} alt="" className="h-16 w-16 object-cover rounded" />
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#d4af37] hover:bg-[#b8941f]"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              No reviews yet. Be the first to review this product!
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{review.user_name}</span>
                      {review.verified_purchase && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <StarRating value={review.rating} />
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {review.title && (
                  <h4 className="font-semibold mb-2">{review.title}</h4>
                )}
                
                <p className="text-gray-700 mb-3">{review.comment}</p>
                
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2">
                    {review.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={resolveImageUrl(img)}
                        alt=""
                        className="h-24 w-24 object-cover rounded cursor-pointer hover:opacity-75"
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewSystem;